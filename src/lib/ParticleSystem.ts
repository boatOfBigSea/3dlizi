import * as THREE from 'three';

export type ShapeType = 'heart' | 'flower' | 'saturn' | 'fireworks';

interface ParticleSystemOptions {
  container: HTMLDivElement;
  particleCount?: number;
  color?: string;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private particles: THREE.Points;
  private geometry: THREE.BufferGeometry;
  
  private positions: Float32Array;
  private targetPositions: Float32Array;
  private originalTargetPositions: Float32Array;
  private velocities: Float32Array;
  
  private particleCount: number;
  private color: THREE.Color;
  
  private animationFrameId: number;
  
  // Interaction variables
  private openness: number = 1.0; // 0 (contracted) to 1 (expanded)
  private currentShape: ShapeType = 'heart';
  private targetColor: THREE.Color;

  constructor(options: ParticleSystemOptions) {
    this.particleCount = options.particleCount || 15000;
    this.color = new THREE.Color(options.color || '#ff3366');
    this.targetColor = this.color.clone();

    this.scene = new THREE.Scene();
    
    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      options.container.clientWidth / options.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(options.container.clientWidth, options.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    options.container.appendChild(this.renderer.domElement);

    // Initialize arrays
    this.positions = new Float32Array(this.particleCount * 3);
    this.targetPositions = new Float32Array(this.particleCount * 3);
    this.originalTargetPositions = new Float32Array(this.particleCount * 3);
    this.velocities = new Float32Array(this.particleCount * 3);

    // Initialize geometry and material
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    
    // Add point size variation
    const sizes = new Float32Array(this.particleCount);
    for (let i = 0; i < this.particleCount; i++) sizes[i] = Math.random();
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    // Custom shader material for better looking particles with bloom/glow illusion
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: this.color },
        uTime: { value: 0 }
      },
      vertexShader: `
        uniform float uTime;
        attribute float aSize;
        varying float vAlpha;
        
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          // Pulsing size based on time and individual particle random size
          float sizePulse = sin(uTime * 2.0 + aSize * 10.0) * 0.5 + 0.5;
          gl_PointSize = (1.5 + sizePulse * 2.0) * (10.0 / -mvPosition.z);
          
          vAlpha = 0.5 + sizePulse * 0.5;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        
        void main() {
          // Circular particle with soft edges
          vec2 xy = gl_PointCoord.xy - vec2(0.5);
          float ll = length(xy);
          if (ll > 0.5) discard;
          
          // Create radial gradient for a glow effect
          float intensity = pow(1.0 - (ll * 2.0), 1.5);
          gl_FragColor = vec4(uColor, intensity * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending // Glow effect
    });

    this.particles = new THREE.Points(this.geometry, material);
    this.scene.add(this.particles);

    // Initial shape generation
    this.generateShape(this.currentShape);

    // Handle resize
    window.addEventListener('resize', this.onWindowResize);

    // Start animation loop
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  public setShape = (shape: ShapeType) => {
    if (this.currentShape === shape) return;
    this.currentShape = shape;
    this.generateShape(shape);
  }

  public setColor = (hexColor: string) => {
    this.targetColor.set(hexColor);
  }

  public setOpenness = (val: number) => {
    // Smooth the openness input
    this.openness += (val - this.openness) * 0.15;
  }

  private generateShape = (shape: ShapeType) => {
    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 3;
      let x = 0, y = 0, z = 0;

      if (shape === 'heart') {
        // Rejection sampling for 3D Heart
        // (x^2 + (9/4)y^2 + z^2 - 1)^3 - x^2*z^3 - (9/80)y^2*z^3 < 0
        // Swap Y and Z for Three.js coordinate system (Y is up)
        let found = false;
        while (!found) {
          x = (Math.random() - 0.5) * 3;
          y = (Math.random() - 0.5) * 3;
          z = (Math.random() - 0.5) * 3;
          
          const xx = x * x;
          const yy = z * z; // Swapped
          const zz = y * y; // Swapped
          
          const part1 = xx + (9/4)*yy + zz - 1;
          const val = part1 * part1 * part1 - xx * (zz * z) - (9/80) * yy * (zz * z);
          
          if (val <= 0) {
             found = true;
          }
        }
        // Scale to fit
        x *= 1.2;
        y *= 1.2;
        z *= 1.2;

      } else if (shape === 'flower') {
        // Simple flower using parametric equations
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI;
        const r = 1.0 + 0.5 * Math.sin(5 * u) * Math.sin(5 * v);
        
        x = r * Math.sin(v) * Math.cos(u) * 1.5;
        y = r * Math.cos(v) * 1.5;
        z = r * Math.sin(v) * Math.sin(u) * 1.5;

      } else if (shape === 'saturn') {
        const isRing = Math.random() > 0.3; // 70% particles for ring
        if (isRing) {
          // Rings
          const angle = Math.random() * Math.PI * 2;
          const radius = 1.6 + Math.random() * 1.2; // Inner 1.6, outer 2.8
          x = Math.cos(angle) * radius;
          y = (Math.random() - 0.5) * 0.1; // Thin disk
          z = Math.sin(angle) * radius;
        } else {
          // Planet sphere
          const u = Math.random() * Math.PI * 2;
          const v = Math.acos(2 * Math.random() - 1);
          const r = 1.0 + (Math.random() - 0.5) * 0.1;
          x = r * Math.sin(v) * Math.cos(u);
          y = r * Math.cos(v);
          z = r * Math.sin(v) * Math.sin(u);
        }
        // Tilt Saturn a bit
        const angle = 0.4;
        const s = Math.sin(angle);
        const c = Math.cos(angle);
        const nz = z * c - y * s;
        const ny = z * s + y * c;
        z = nz; y = ny;

      } else if (shape === 'fireworks') {
        // Sphere of random radius heavily biased towards edge
        const u = Math.random() * Math.PI * 2;
        const v = Math.acos(2 * Math.random() - 1);
        const r = Math.cbrt(Math.random()) * 2.5; // Distribute evenly inside a sphere, scale 2.5
        x = r * Math.sin(v) * Math.cos(u);
        y = r * Math.cos(v);
        z = r * Math.sin(v) * Math.sin(u);
      }

      this.originalTargetPositions[idx] = x;
      this.originalTargetPositions[idx + 1] = y;
      this.originalTargetPositions[idx + 2] = z;

      // Start position from center if we are newly generating (e.g. initial load)
      // or keep current position and let interpolation handle it
      if (this.positions[idx] === 0 && this.positions[idx+1] === 0 && this.positions[idx+2] === 0) {
         this.positions[idx] = (Math.random() - 0.5) * 0.1;
         this.positions[idx + 1] = (Math.random() - 0.5) * 0.1;
         this.positions[idx + 2] = (Math.random() - 0.5) * 0.1;
      }
    }
  }

  private onWindowResize = () => {
    if (!this.renderer || !this.camera) return;
    const container = this.renderer.domElement.parentElement;
    if (!container) return;
    
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    // Time for shaders
    const time = performance.now() * 0.001;
    (this.particles.material as THREE.ShaderMaterial).uniforms.uTime.value = time;

    // Smooth color change
    this.color.lerp(this.targetColor, 0.05);

    // Apply interaction (openness modifies scale/scattering)
    // openness === 0 (Fist): bring particles closer together (scale down)
    // openness === 1 (Open): normal target positions + maybe some expansion or scattering
    // Map openness [0, 1] to scale [0.3, 1.2] roughly
    const scaleFactor = 0.2 + (this.openness * 1.0);
    // Extra scatter factor if very open
    const scatterOffset = Math.max(0, this.openness - 0.8) * 1.5;

    for (let i = 0; i < this.particleCount; i++) {
        const idx = i * 3;
        
        // Base target position scaled by openness
        let tx = this.originalTargetPositions[idx] * scaleFactor;
        let ty = this.originalTargetPositions[idx + 1] * scaleFactor;
        let tz = this.originalTargetPositions[idx + 2] * scaleFactor;

        // Add scatter offset if hand is very open (like an explosion effect)
        // Scatter noise based on original position roughly
        if (scatterOffset > 0) {
            const mag = Math.sqrt(tx*tx + ty*ty + tz*tz) + 0.1;
            tx += (tx / mag) * scatterOffset * (Math.sin(time + i) * 0.5 + 0.5);
            ty += (ty / mag) * scatterOffset * (Math.cos(time + i) * 0.5 + 0.5);
            tz += (tz / mag) * scatterOffset * (Math.sin(time*0.5 + i) * 0.5 + 0.5);
        }

        // Add some very subtle swarming motion to the target based on time
        tx += Math.sin(time * 0.5 + this.originalTargetPositions[idx+1]) * 0.1;
        ty += Math.cos(time * 0.6 + this.originalTargetPositions[idx+2]) * 0.1;

        this.targetPositions[idx] = tx;
        this.targetPositions[idx + 1] = ty;
        this.targetPositions[idx + 2] = tz;

        // Animate positions to target with some "spring" physics or simple lerp
        // We use a fast lerp for responsiveness, but slightly lagged for smoothness
        const springSpeed = 0.08 + (Math.random() * 0.02);
        
        // if hand is closed (openness small), move faster to center
        const actualSpeed = this.openness < 0.3 ? springSpeed * 1.5 : springSpeed;

        this.positions[idx] += (this.targetPositions[idx] - this.positions[idx]) * actualSpeed;
        this.positions[idx + 1] += (this.targetPositions[idx + 1] - this.positions[idx + 1]) * actualSpeed;
        this.positions[idx + 2] += (this.targetPositions[idx + 2] - this.positions[idx + 2]) * actualSpeed;
    }

    // Slowly rotate the entire system
    this.particles.rotation.y += 0.002;
    this.particles.rotation.x += 0.0005;

    this.geometry.attributes.position.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    window.removeEventListener('resize', this.onWindowResize);
    cancelAnimationFrame(this.animationFrameId);
    this.geometry.dispose();
    this.particles.material.dispose();
    this.renderer.dispose();
  }
}
