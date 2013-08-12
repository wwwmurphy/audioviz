
var alsa = require('alsa');
var FFT = require('fft');
var sockio = require('socket.io');
var http = require('http');
var static = require('node-static');

// default socket port.
var port = 8080;

// defaults for audio capture.
var devin = 'plughw:0,0';                // ALSA device
var devin_gain = 30;                     // good default for my mic.

var channels = 2,                        // Stereo
    rate = 44100,                        // Sample rate
    format = alsa.FORMAT_S16_LE,         // PCM format (signed 16bit LE int)
    access = alsa.ACCESS_RW_INTERLEAVED, // Access mode
    latency = 300;                       // Desired latency in millisecs

var stream_on = false;    // flag for getting the next audio chunk.
  
// The Capture class is a stream.Readable subclass.
var capture = new alsa.Capture(devin,channels,rate,format,access,latency);
if ( capture === null ) {
  console.err("Device not found: " + devin);
  process.exit();
}

var nachunk = 1024;  // size of an audio chunk.

// make an FFT instance
var fft = new FFT.complex(nachunk, false);

var iachunk = new Float32Array(2 * nachunk);
var oachunk = new Float32Array(2 * nachunk);
var HanWin  = new Float32Array(nachunk);
var SpectraSlice = new Float32Array(nachunk/2);
var twopi = 2 * Math.PI;

// Make a Han Window
for ( i=0; i<nachunk; i++) {
   HanWin[i] = 0.5 * (1-Math.cos(twopi * i /(nachunk-1)));
}

  var fsrv = new static.Server('./');

  function fileHandler(req, res) {
    req.addListener('end', function () {
      console.log("Request URL: " + req.url);
      fsrv.serve(req, res);
    }).resume();
  }



  var httpServer = http.createServer(fileHandler);

  var io = sockio.listen(httpServer);
  io.set('log level', 0);

  httpServer.listen(port);



  // Now the event handlers:
  io.sockets.on('connection', function (socket) {
    // Send vertical step size in Hz.
    socket.emit('freqstep', rate/nachunk/2);

    // Control Events Start and Stop data collection, processing and transfer.
    socket.on('control event', function (data) {
      console.log(data);
      if ( data['cmd'] == 'start' ) {
        stream_on = true;
        capture.resume();
      }
      else if ( data['cmd'] == 'stop') {
        stream_on = false;
        capture.pause();
      }
    });

    capture.on('readable', function () {
      var buf = capture.read(nachunk * 4); // 4 bytes per frame
      if ( buf === null ) {
        console.error("No audio captured: " + devin);
        process.exit();
      }

      // Combine L & R channels together and amplify the volume.
      for ( i=0; i< nachunk; i++ ) {
        iachunk[i] =
          (buf.readInt16LE(i*4) + buf.readInt16LE((i*4)+2))
          * devin_gain;
      }

      // Apply Han Window to audio input section
      // for ( i=0; i<nachunk; i++) {
      //    iachunk *= HanWin[i];
      // }

      var re, im, max_eng;
      // Need to pick max value to normalize energy level during its display.
      // Energy levels in a spectral slice can range from 0-255,
      // normalize to that; this is a display limitation. Can add 
      // AGC to this later.
      max_eng = 1000000;

      fft.simple(oachunk, iachunk, 'complex'); // 'complex' or 'real'
      var tmp;
      for ( i=0; i< nachunk/2; i++ ) {
        re = oachunk[2*i];
        im = oachunk[2*i+1];
        tmp = ( 255 * Math.sqrt((re*re)+(im*im)) ) / max_eng;
        if ( tmp > 255 ) { tmp = 255; }
        if ( tmp <  15 ) { tmp = 0; }
        SpectraSlice[i] = Math.floor(tmp);
      }

      // Scale Y-axis by dropping top half and expanding lower half.
      var explower = []; 
      for ( i=0; i< nachunk; i++ ) {
        explower[i] = SpectraSlice[i];
      }
      for ( i=0; i< nachunk; i+=2 ) {
        SpectraSlice[i]   = explower[i/2];
        SpectraSlice[i+1] = explower[i/2];
      }

      // Send Spectral energy array for entire slice.
      socket.emit('slice', SpectraSlice );

      // Cause next slice data capture to be scheduled.
      if ( stream_on === true ) {
        capture.read(0);
      }
    });

  });

//--------------------------------------------

