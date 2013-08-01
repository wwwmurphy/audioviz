var alsa = require('alsa');
var fft = require('fft');
var sockio = require('socket.io');

// deafult for socket IO.
var port = 8080;

// defaults for audio capture.
var devin = 'plughw:0,0';                // ALSA device

var channels = 2,                        // Stereo
    rate = 44100,                        // Sample rate
    format = alsa.FORMAT_S16_LE,         // PCM format (signed 16bit LE int)
    access = alsa.ACCESS_RW_INTERLEAVED, // Access mode
    latency = 300;                       // Desired latency in millisecs
var stream_on = false;    // flag for getting the next audio chunk.

var io = sockio.listen(8080);
io.set('log level', 0);
  
// The Capture class is a stream.Readable subclass.
var capture = new alsa.Capture(devin,channels,rate,format,access,latency);
if ( capture === null ) {
  console.err("Device not found: " + devin);
  process.exit();
}

var nachunk = 1024;  // size of an audio chunk.

// make an FFT instance
var ffti = new fft.complex(nachunk, false);

var iachunk = new Float64Array(2 * nachunk);
var oachunk = new Float64Array(2 * nachunk);
var HanWin  = new Float64Array(nachunk);
var SpectraSlice = new Float32Array(nachunk/2);
var twopi = 2 * Math.PI;

// Make a Han Window
for ( i=0; i<nachunk; i++) {
   HanWin[i] = 0.5 * (1-Math.cos(twopi * i /(nachunk-1)));
}


// Now the event handlers:

  io.sockets.on('connection', function (socket) {
  //  socket.emit('news', { hello: 'world' });

    socket.on('control event', function (data) {
      console.log(data);
      if ( data['cmd'] == 'start' ) {
        stream_on = true;
        capture.resume();
        console.log('Resume');
      }
      else if ( data['cmd'] == 'stop') {
        stream_on = false;
        capture.pause();
        console.log('Pause');
      }
    });

  capture.on('readable', function () {
    var buf = capture.read(nachunk * 4); // 4 bytes per frame
    if ( buf === null ) {
      console.error("No audio captured: " + devin);
      process.exit();
    }
    //console.log("Got a chunk");

    for ( i=0; i< nachunk; i++ ) {
      iachunk[i] = // average L & R channels together
        (buf.readInt16LE(i*4) + buf.readInt16LE((i*4)+2))/2;
    }

  //TODO  Add a low-pass filter here.

    // Apply Han Window to audio input section
  //  for ( i=0; i<nachunk; i++) {
  //     iachunk *= HanWin[i];
  //  }

    var re, im;
    var fstep = rate / nachunk / 2;
    ffti.simple(oachunk, iachunk, 'complex'); // 'complex' or 'real'
    for ( i=0; i< nachunk/2; i++ ) {
      re = oachunk[2*i];
      im = oachunk[2*i+1];
      SpectraSlice[i] =  Math.sqrt((re*re)+(im*im));
    }
    socket.emit('freqstep', fstep );
    socket.emit('slice', SpectraSlice );
//    console.log("Sent Spectrogram Slice");
    if ( stream_on === true ) {
      capture.read(0);
    }
  });

  });

//--------------------------------------------


