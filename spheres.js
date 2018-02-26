/**
 * @file mp4.js
 * Write a simple particle system using WebGL to handle the display.
 * @author Tingrui Guan
 */

var gl;
var canvas;
var shaderProgram;

var sphereVertexPositionBuffer;
var sphereVertexNormalBuffer;

// create an array to store the currently displayed spheres
var particles = [];

//set matrix
var mvMatrix = mat4.create();
var pMatrix = mat4.create();
var nMatrix = mat3.create();

// View parameters
var eyePt = vec3.fromValues(0.0,0.0,100.0);
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
var up = vec3.fromValues(0.0,1.0,0.0);
var viewPt = vec3.fromValues(0.0,0.0,0.0);

// boundary limits for the box (for X, Y, Z axis)
var boxBound = 30.0;


//-------------------------------------------------------------------------
/**
 * Sphere class. Each sphere has position, velocity, 3 color for the shaders, radius and mass
 */
class Sphere {
  constructor () {
    this.position = vec3.fromValues(rand(boxBound-2),rand(boxBound-2),rand(boxBound-2));
    this.velocity = vec3.fromValues(rand(20.0),rand(20.0),rand(20.0));
    this.radius = Math.random()*4;
    this.mass = 0.3*Math.pow(this.radius, 3)*3.14;

    // colors
    this.colorA = vec3.fromValues(Math.random(),Math.random(),Math.random());
    this.colorD = vec3.fromValues(Math.random(),Math.random(),Math.random());
    this.colorS = vec3.fromValues(Math.random(),Math.random(),Math.random());
  }
  update(f, dt) {
    // update position according to velocity
    // using Euler Intergration
    this.position[0] += this.velocity[0] * dt;
    this.position[1] += this.velocity[1] * dt;
    this.position[2] += this.velocity[2] * dt;

    // collision on the boundary
    if (this.position[0] >= boxBound || this.position[0] <= - boxBound) {
      // change velocity to opposite direction
      this.velocity[0] = - this.velocity[0]
    }
    if (this.position[1] >= boxBound || this.position[1] <= - boxBound) {
      // change velocity to opposite direction
      this.velocity[1] = - this.velocity[1]
    }
    if (this.position[2] >= boxBound || this.position[2] <= - boxBound) {
      // change velocity to opposite direction
      this.velocity[2] = - this.velocity[2]
    }

    // updating accelaration according to force
    var a = vec3.fromValues(f[0] / this.mass, f[1] / this.mass, f[2] / this.mass);

    // updating velocity according to accelaration
    this.velocity[0] += a[0] * dt;
    this.velocity[1] += a[1] * dt;
    this.velocity[2] += a[2] * dt;

    // bound velocity
    if (norm(this.velocity)<1.0 && this.position[1]==0){
      this.velocity[0] =0;
      this.velocity[1] =0;
      this.velocity[2] =0;
    }
    if(this.velocity[0] >= 50.0) {
      this.velocity[0] = 50.0;
    }
    if(this.velocity[1] >= 50.0) {
      this.velocity[1] = 50.0;
    }
    if(this.velocity[2] >= 50.0) {
      this.velocity[2] = 50.0;
    }

  }
  gravity () {
    var g = 9.8;
    return vec3.fromValues(0,-g*this.mass,0);
  }
  friction () {
    var friction_factor = 0.35;
    return vec3.fromValues(-friction_factor*this.velocity[0],-friction_factor*this.velocity[1],-friction_factor*this.velocity[2]);
  }
  totalForce () {
    return add(this.gravity(), this.friction());
  }
}

//-------------------------------------------------------------------------

/**
 * Setup the fragment and vertex shaders
 */
function setupShaders() {
  vertexShader = loadShaderFromDOM("shader-vs");
  fragmentShader = loadShaderFromDOM("shader-fs");

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(shaderProgram);
  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");

  shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");

  shaderProgram.uniformAmbientLightColor = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");
  shaderProgram.uniformDiffuseLightColor = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
  shaderProgram.uniformSpecularLightColor = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");

  shaderProgram.uniformAmbientMatColor = gl.getUniformLocation(shaderProgram, "uAmbientMatColor");
  shaderProgram.uniformDiffuseMatColor = gl.getUniformLocation(shaderProgram, "uDiffuseMatColor");
  shaderProgram.uniformSpecularMatColor = gl.getUniformLocation(shaderProgram, "uSpecularMatColor");
}

/**
 * draw
 **/
function draw() {
  var transformVec = vec3.create();

  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // We'll use perspective
  mat4.perspective(pMatrix,degToRad(45), gl.viewportWidth / gl.viewportHeight, 0.1, 200.0);

  // We want to look down -z, so create a lookat point in that direction
  vec3.add(viewPt, eyePt, viewDir);
  // Then generate the lookat matrix and initialize the MV matrix to that view
  mat4.lookAt(mvMatrix,eyePt,viewPt,up);

  // light parameters
  var LightA = vec3.fromValues(1.0, 1.0, 1.0);
  var LightD = vec3.fromValues(1.0, 1.0, 1.0);
  var LightS = vec3.fromValues(1.0, 1.0, 1.0);
  var lightPosEye4 = vec4.fromValues(0.0, 40.0, 50.0, 1.0);
  lightPosEye4 = vec4.transformMat4(lightPosEye4, lightPosEye4, mvMatrix);
  var lightPosEye3 = vec3.fromValues(lightPosEye4[0], lightPosEye4[1], lightPosEye4[2]);

  for (var i = 0; i < particles.length; i++) {
    var curr = particles[i];
    mvPushMatrix();
    mat4.translate(mvMatrix, mvMatrix, curr.position);
    vec3.set(transformVec, curr.radius, curr.radius, curr.radius);
    mat4.scale(mvMatrix, mvMatrix, transformVec);
    uploadLightsToShader(lightPosEye3, LightA, LightD, LightS);
    uploadMaterialToShader(curr.colorA, curr.colorD, curr.colorS);
    setMatrixUniforms();
    drawSphere();
    mvPopMatrix();
  }

}

/**
 * Populate sphere buffers with data using the generate sphere from subdivision function in simpleModeling
 * Update the normal buffers as well.
 */
function setupBuffers() {
  var sphereSoup=[];
  var sphereNormals=[];
  var numT=sphereFromSubdivision(6,sphereSoup,sphereNormals);

  sphereVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereSoup), gl.STATIC_DRAW);
  sphereVertexPositionBuffer.itemSize = 3;
  sphereVertexPositionBuffer.numItems = numT*3;

  // Specify normals to be able to do lighting calculations
  sphereVertexNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereNormals),
                gl.STATIC_DRAW);
  sphereVertexNormalBuffer.itemSize = 3;
  sphereVertexNormalBuffer.numItems = numT*3;
}

/**
 * draw a sphere
 */
function drawSphere(){
 gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
 gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, sphereVertexPositionBuffer.itemSize,
                         gl.FLOAT, false, 0, 0);

 // Bind normal buffer
 gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
 gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute,
                           sphereVertexNormalBuffer.itemSize,
                           gl.FLOAT, false, 0, 0);
 gl.drawArrays(gl.TRIANGLES, 0, sphereVertexPositionBuffer.numItems);
}

//vars used in animation
var lastTime = 0;

/**
 * Animation to be called from tick. Updates globals and performs animation for each tick.
 */
function animate() {
    //set each frame according to time
    var timeNow = new Date().getTime();
    var dt = 0;
    if (lastTime != 0) {
        dt = (timeNow - lastTime)/900;
    }
    lastTime = timeNow;

    for (var i = 0; i < particles.length; i++) {
      particles[i].update(particles[i].totalForce(), dt);
    }

    for (var i = 0; i < particles.length - 1; i++)
    {
        for (var j = i + 1; j < particles.length; j++)
        {
            if (norm(sub(particles[i].position, particles[j].position)) <= (particles[i].radius + particles[j].radius))
            {
              var tmp = particles[i].velocity;
              particles[i].velocity = particles[j].velocity;
              particles[j].velocity = tmp;
            }
        }
    }
}

/**
 * Startup function called from html code to start program.
 */
 function startup() {
     canvas = document.getElementById("myGLCanvas");
     gl = createGLContext(canvas);
     //initialize particles (default amount)
     for (var i = 0; i < 30; i++)
     {
         particles.push(new Sphere());
     }

     setupShaders();
     setupBuffers();
     document.onkeydown = handleKeyDown;
     document.onkeyup = handleKeyUp;

     //handle the ui
     reset_button = document.getElementById("reset_particles");
     reset_button.onclick = function () {
         particles = [];
     };

     canvas.onclick = function () {
         particles.push(new Sphere());
     };

     particleNum = document.getElementById("particle_num");

     //set background color to white
     gl.clearColor(0.0, 0.0, 0.0, 1.0);
     gl.enable(gl.DEPTH_TEST);

     tick();
}

/**
 * Tick called for every animation frame.
 */
function tick() {
    requestAnimFrame(tick);
    handleKeys();
    draw();
    animate();
    // show the total number
    particleNum.innerHTML = "Total Spheres: " + particles.length;
}

/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}

/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

/**
 * Loads Shaders
 * @param {string} id ID string for shader to load. Either vertex shader/fragment shader
 */
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);

  // If we don't find an element with the specified id
  // we do an early exit
  if (!shaderScript) {
    return null;
  }

  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }

  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

//helpers

// matrix stack
var mvMatrixStack = [];

/**
 * Pushes matrix onto modelview matrix stack
 */
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}

/**
 * Pops matrix off of modelview matrix stack
 */
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

/**
 * Gnerate a random number with given range
 * @param limit
 * @returns a random number between [-limit, limit]
 */
function rand(limit) {
    return Math.random() * limit * 2 - limit;
}

/**
 * Sends projection/modelview/normal matrices to shader
 */
function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform,
                        false, pMatrix);
    uploadNormalMatrixToShader();
}

/**
 * Upload Normal matrices to shader
 */
function uploadNormalMatrixToShader(){
  mat3.fromMat4(nMatrix,mvMatrix);
  mat3.transpose(nMatrix,nMatrix);
  mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//-------------------------------------------------------------------------
/**
 * Upload Light to shader
 */
function uploadLightsToShader(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPosition, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColor, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColor, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColor, s);
}

//-------------------------------------------------------------------------
/**
 * Upload Material to shader
 */
function uploadMaterialToShader(a,d,s) {
  gl.uniform3fv(shaderProgram.uniformAmbientMatColor, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseMatColor, d);
  gl.uniform3fv(shaderProgram.uniformSpecularMatColor, s);
}

// vector calculation helpers
//----------------------------------------------------------------------------------

/**
 * Compute the norm of a vector
 * @param v
 * @returns {number}
 */
function norm(v){
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + 1e-6);
}

/**
 * Add two vectors
 * @param v1
 * @param v2
 * @returns {*}
 */
function add(v1, v2) {
    return vec3.fromValues(v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]);
}

/**
 * Substract two vectors
 * @param v1
 * @param v2
 * @returns {*}
 */
function sub(v1, v2) {
    return vec3.fromValues(v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]);
}

//keys
//Code to handle user interaction
var currentlyPressedKeys = {};

/**
 * Handle down key
 * @param event
 */
function handleKeyDown(event) {
        currentlyPressedKeys[event.keyCode] = true;
}

/**
 * Handle up key
 * @param event
 */
function handleKeyUp(event) {
        currentlyPressedKeys[event.keyCode] = false;
}

/**
 * Handle keys
 */
 function handleKeys(){

   if (currentlyPressedKeys[32]) {
       // if space is pressed, create new spheres
       if (particles.length < 500)
       {
           particles.push(new Sphere());
       }
   }
 }
