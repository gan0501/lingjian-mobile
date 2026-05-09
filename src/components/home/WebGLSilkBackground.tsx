import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #0b0f19; }
    canvas { width: 100vw; height: 100vh; display: block; }
  </style>
</head>
<body>
  <canvas id="glcanvas"></canvas>
  <script>
    const canvas = document.getElementById('glcanvas');
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });

    const vsSource = \`
      attribute vec4 aVertexPosition;
      void main() {
        gl_Position = aVertexPosition;
      }
    \`;

    const fsSource = \`
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;

      float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      float noise(in vec2 st) {
          vec2 i = floor(st);
          vec2 f = fract(st);
          float a = random(i);
          float b = random(i + vec2(1.0, 0.0));
          float c = random(i + vec2(0.0, 1.0));
          float d = random(i + vec2(1.0, 1.0));
          vec2 u = f*f*(3.0-2.0*f);
          return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      const mat2 m2 = mat2(0.8,-0.6,0.6,0.8);
      float fbm( in vec2 p ){
          float res = 0.0, fre=1.0, amp=1.0;
          for( int i=0; i<4; i++ ) {
              res += amp * noise( p );
              p = m2 * p * 2.0;
              fre *= 2.0;
              amp *= 0.5;
          }
          return res;
      }

      void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution.xy;
          vec2 p = uv * 2.0 - 1.0;
          p.x *= u_resolution.x / u_resolution.y;

          float t = u_time * 0.15;
          
          float n1 = fbm(p * 2.5 + vec2(t * 0.5, -t * 0.3));
          float n2 = fbm(p * 3.0 - vec2(-t * 0.2, t * 0.4) + n1 * 1.5);
          
          float wave = sin((p.x + p.y)*3.0 + n2 * 5.0 + t * 2.0);
          float sheen = smoothstep(-0.8, 1.2, wave);

          vec3 baseColor = vec3(0.09, 0.08, 0.12);
          vec3 hiColor = vec3(0.35, 0.32, 0.4); 

          vec3 color = mix(baseColor, hiColor, sheen);
          float grain = random(uv + mod(u_time, 100.0)) * 0.05;
          float dist = length(uv - 0.5);
          color -= dist * 0.3;

          gl_FragColor = vec4(color + grain, 1.0);
      }
    \`;

    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0,  1.0,  1.0,  1.0,  -1.0, -1.0,  1.0, -1.0,
    ]), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, 'aVertexPosition');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5); 
      const displayWidth  = window.innerWidth;
      const displayHeight = window.innerHeight;
      
      canvas.width  = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    let lastFrameTime = 0;
    const FPS_LIMIT = 30;
    const FRAME_DURATION = 1000 / FPS_LIMIT;

    function render(time) {
      requestAnimationFrame(render);
      
      if (time - lastFrameTime < FRAME_DURATION) return;
      lastFrameTime = time;

      let t = (time * 0.001) % 100000.0;
      gl.uniform1f(uTime, t);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(render);
  </script>
</body>
</html>
`;

export const WebGLSilkBackground: React.FC = () => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        source={{ html: htmlContent }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
};
