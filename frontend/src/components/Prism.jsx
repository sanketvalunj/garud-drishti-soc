import React, { useEffect, useRef } from 'react';
import { Renderer, Camera, Transform, Program, Mesh, Triangle } from 'ogl';

// Standard 2D noise shader function implementation for Prism component visuals. 
// Embedded into fragment shader to keep component portable.

const vertexScale = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position, 0, 1);
}
`;

const fragmentAnimation = `
precision highp float;
uniform float uTime;
uniform float uHueShift;
uniform float uGlow;
uniform float uColorFrequency;
varying vec2 vUv;

// A simple deterministic pseudo-random 2D noise implementation.
float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 n) {
    const vec2 d = vec2(0.0, 1.0);
    vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
    return mix(mix(rand(b), rand(b + d.yx), f.x), mix(rand(b + d.xy), rand(b + d.yy), f.x), f.y);
}

void main() {
    vec2 uv = vUv - 0.5;
    
    // Animate a simple prismatic organic pattern
    float t = uTime * 0.5;
    
    float noiseVal = noise(uv * 10.0 + t);
    
    // Calculate a hue based on the angle and distance with offsets
    float angle = atan(uv.y, uv.x);
    float dist = length(uv);
    
    // Abstract Color math incorporating uHueShift and uGlow
    float colorShift = (angle + uHueShift * 3.14159 / 180.0) * uColorFrequency;
    vec3 col = 0.5 + 0.5 * cos(uTime + uv.xyx + vec3(0,2,4) + colorShift);
    
    // Mix with noise and apply a soft glow based on dist
    col = mix(col, vec3(noiseVal), 0.2);
    float alpha = smoothstep(0.8, 0.2, dist) * uGlow;

    gl_FragColor = vec4(col, alpha);
}
`;

const Prism = ({
    animationType = 'rotate',
    timeScale = 1.0,
    height = 3.5,
    baseWidth = 5.5,
    scale = 3.6,
    hueShift = 0,
    colorFrequency = 1,
    noise = 0,
    glow = 1
}) => {
    const mountRef = useRef(null);
    const uniformsRef = useRef(null);

    // 1. Context Init: Runs exactly ONCE on mount
    useEffect(() => {
        // Create Renderer
        const renderer = new Renderer({ alpha: true, antialias: true, dpr: window.devicePixelRatio || 2 });
        const gl = renderer.gl;
        mountRef.current.appendChild(gl.canvas);

        // Initial Uniforms State
        uniformsRef.current = {
            uTime: { value: 0 },
            uHueShift: { value: hueShift },
            uGlow: { value: glow },
            uColorFrequency: { value: colorFrequency },
        };

        // Fullscreen Triangle Geometry
        const geometry = new Triangle(gl);

        // Program with Shaders
        const program = new Program(gl, {
            vertex: vertexScale,
            fragment: fragmentAnimation,
            uniforms: uniformsRef.current,
            transparent: true,
            depthTest: false,
        });

        const mesh = new Mesh(gl, { geometry, program });

        // Render loop
        let animationId;
        const render = (t) => {
            if (uniformsRef.current) {
                uniformsRef.current.uTime.value = t * 0.001 * timeScale;
            }
            renderer.render({ scene: mesh });
            animationId = requestAnimationFrame(render);
        };
        animationId = requestAnimationFrame(render);

        const resize = () => {
            if (mountRef.current) {
                renderer.setSize(window.innerWidth, window.innerHeight);
            }
        };
        window.addEventListener('resize', resize);
        resize(); // initial size match

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationId);
            if (mountRef.current && gl.canvas.parentNode) {
                mountRef.current.removeChild(gl.canvas);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps ensure canvas isn't destroyed on prop change

    // 2. Uniform Mutations: Sync changes flawlessly and softly without rebaking layout
    useEffect(() => {
        if (uniformsRef.current) {
            // Direct mutating shaders prevents re-render thrash
            uniformsRef.current.uHueShift.value = hueShift;
            uniformsRef.current.uGlow.value = glow;
            uniformsRef.current.uColorFrequency.value = colorFrequency;
        }
    }, [hueShift, glow, colorFrequency]);

    return <div ref={mountRef} className="prism-canvas-container" style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }} />;
};

export default React.memo(Prism);
