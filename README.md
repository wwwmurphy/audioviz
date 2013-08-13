audioviz
========

Show Realtime Power Spectra of Audio Stream

This project was a learning experience for me to get familiar with Node.JS.
There's nothing in this program that hasn't already be done in other
ways and certainly done better. But creating this program sure got me
started in Node.JS.

This program will open an audio stream using ALSA on the server. It will
read blocks of incoming audio, perform an FFT and send the transformed
and scaled output to javascript waiting in a browser. The data goes across
in a web socket using socket.io, is colored to show spectral intensity
and then painted into an HTML canvas.

This program uses the mainstays of modern javascript programming. It is
event driven, has anonymous functions and closures.


To Use:
1. Have a microphone connected to the 0,0 ALSA port on your computer.
2. Have 'audioviz.js' and 'index.html' in the same directory.
3. Launch the server side by invoking: 'node audioviz.js'
4. Launch the client side by browsing to: 'localhost:8080'
The on-screen buttons are simple and self-explanatory.


To Do:
1. Add pulldown menu to web page to select different ALSA audio port.
2. Add command line argument to change socket port for web page conenction.
3. Add ability to change sampling rate dynamically on-screen.
4. Add ability to scale Y-axis frequency display.


Best Regards - Walter Murphy
walter.murphy@gmail.com
13 August 2013

