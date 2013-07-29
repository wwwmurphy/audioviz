
var fs = require('fs');
var alsa = require('alsa');
var fft = require('fft');
var bufwr = require ("buffered-writer");

    // defaults for Playback and Capture constructors.
var devout = 'plughw:0,0',                // ALSA device
    devin = 'plughw:0,0',                 // ALSA device
    channels = 2,                         // Stereo
    rate = 44100,                         // Sample rate
    format = alsa.FORMAT_S16_LE,          // PCM format (signed 16 bit LE int)
    access = alsa.ACCESS_RW_INTERLEAVED,  // Access mode
    latency = 300;                        // Desired latency in milliseconds
  
  // The Capture class is a stream.Readable subclass.
  var capture = new alsa.Capture(devin,channels,rate,format,access,latency);


  var hdr = new Buffer([
  // Just static values here. Dynamic values written in next section.
  0x52,0x49,0x46,0x46,   // "RIFF"
  0x00, 0x00, 0x00, 0x00,
  0x57, 0x41, 0x56, 0x45, 0x66, 0x6D, 0x74, 0x20, // "WAVEfmt " 
  0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x02, 0x00,
  0x44, 0xAC, 0x00, 0x00, 0x10, 0xB1, 0x02, 0x00,
  0x04, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, // "data"
  0x00, 0x00, 0x00, 0x00,
  ]);

  // Dynamic Header values.
  var data_len = 44100 * 4 * 5;
  hdr.writeUInt32LE(0x10, 16);     // format data length
  hdr.writeUInt16LE(0x01, 20);     // format
  hdr.writeUInt16LE(channels, 22); // num channels, 2
  hdr.writeUInt32LE(rate, 24);     // sample rate, 44100
  hdr.writeUInt32LE(0x2B110, 28);  // samprate*bps*chans/8
  hdr.writeUInt16LE(0x04, 32);     // 4: 16bit stereo
  hdr.writeUInt16LE(0x10, 34);     // bps
  hdr.writeUInt32LE(data_len, 40); // data section length
  hdr.writeUInt32LE(data_len + hdr.length, 4); // overall file length

  var fd = fs.openSync('./aud.bin', 'w');
  fs.writeSync(fd, hdr, 0, hdr.length, null);
//  console.log("Wrote wav file header of length " + hdr.length);

  var bwr = bufwr.open('data.bin');
  bwr.on("error", function (error){ console.log (error);})

  var nachunk = 1024;  // size of an audio chunk.

//nachunk = 8;
  // make an FFT instance
  var ffti = new fft.complex(nachunk, false);

  var iachunk = new Float64Array(2 * nachunk);
  var oachunk = new Float64Array(2 * nachunk);
  var HanWin  = new Float64Array(nachunk);
  var twopi = 2 * Math.PI;

  // Make a Han Window
  for ( i=0; i<nachunk; i++) {
     HanWin[i] = (1-Math.cos(twopi * i /(nachunk-1))) / 2;
  }

  console.log("reset");
  console.log("set title \"TITLE\"");
  console.log("set style line 11 lc rgb '#808080' lt 1");
  console.log("set border 3 front ls 11");
  console.log("unset key");
  console.log("set tmargin 4");
  console.log("set palette gray negative");
  console.log("unset colorbox");
  console.log("set cbrange[0:1.5]");
  console.log("set xlabel 'Frequency (Hz)'");
  console.log("set ylabel 'Energy (normalized)'");
  console.log("plot \"-\" smooth unique");

  capture.on('readable', function () {
    var buf = capture.read(nachunk * 4); // 4 bytes per frame
//    console.log("buf.length= " + buf.length);
//console.log(buf);


    for ( i=0; i< nachunk; i++ ) {
      iachunk[i] = // average L & R channels together
        (buf.readInt16LE(i*4) + buf.readInt16LE((i*4)+2))/2;
    }

//TODO  Add a low-pass filter here.
//

    // Apply Han Window to audio input section
//    for ( i=0; i<nachunk; i++) {
//       iachunk *= HanWin[i];
//    }

//    // generate pure sine wave for testing
//    var freq = 1000;
//    var step = (freq * 2 * Math.PI) / rate;
//    for (var i = 0; i < nachunk; i++) {
//      iachunk[i] = Math.sin(i * step);
//    }

    var re, im;
    var fstep = rate / nachunk / 2;
    ffti.simple(oachunk, iachunk, 'complex'); // 'complex' or 'real'
      for ( i=0; i< nachunk/2; i++ ) {
        re = oachunk[2*i];
        im = oachunk[2*i+1];
        console.log('%d %d', i * fstep, (re*re) + (im*im));
      }
      console.log();
    capture.read(0);

    console.log("e");
    console.log("pause -1");
    console.log("reset");
    process.exit();
  });

