import {  
  addDebugDiv,
  Resources, 
  AppWrapper,
  CIDS,
  LOG,
  TEXT_IDS  
} from "@webrcade/app-common"

export class Emulator extends AppWrapper {
  constructor(app, debug = false) {
    super(app, debug);

    this.javatari = null;
    this.romBlob = null;
    this.romName = null;
    this.swapJoysticks = false;
    this.debugDiv = null;
    this.targetFps = 60;

    if (this.debug) {
      this.debugDiv = addDebugDiv();      
    }
  }

  createStorage() {
    // no storage
    return null;
  }

  createVisibilityMonitor() {
    // no visibility monitor necessary
    return null;
  }

  createAudioProcessor() {
    // no audio processor necessary
    return null;
  }

  setRom(blob, name) {      
    if (blob.size === 0) {
      throw new Error("The size is invalid (0 bytes).");
    }
    this.romBlob = blob;
    this.romName = name ? name : 'rom';
  }

  setSwapJoysticks(swap) {
    this.swapJoysticks = (swap === true);
  }
  
  pollControls = () => {
    const { app, controllers, javatari, swapJoysticks } = this;
    const { console } = javatari.room;

    let SWCHA = 0xff;  // All directions of both controllers OFF
    let SWCHB = 0x0b; // Reset OFF; Select OFF; B/W OFF; Difficult A/B OFF (Amateur)

    controllers.poll();

    for (let i = 0; i < 2; i++) {
      const joy2 = (i === 1 ? !swapJoysticks : swapJoysticks);

      if (controllers.isControlDown(i, CIDS.ESCAPE)) {
        if (this.pause(true)) {
          controllers.waitUntilControlReleased(i, CIDS.ESCAPE)
            .then(() => controllers.setEnabled(false))
            .then(() => { app.pause(() => { 
                controllers.setEnabled(true);
                this.pause(false); 
              }); 
            })
            .catch((e) => LOG.error(e))
          return;
        }
      }

      if (controllers.isControlDown(i, CIDS.RIGHT)) {
        SWCHA &= (joy2 ? 0xf7 : 0x7f);
      }
      if (controllers.isControlDown(i, CIDS.LEFT)) {
        SWCHA &= (joy2 ? 0xfb : 0xbf);
      }
      if (controllers.isControlDown(i, CIDS.UP)) {
        SWCHA &= (joy2 ? 0xfe : 0xef);
      }
      if (controllers.isControlDown(i, CIDS.DOWN)) {
        SWCHA &= (joy2 ? 0xfd : 0xdf);
      }

      console.joyButtonPressed(joy2 ? 1 : 0, controllers.isControlDown(i, CIDS.A));
    }

    if (controllers.isControlDown(0, CIDS.START) || 
      controllers.isControlDown(1, CIDS.START)) {
      SWCHB &= 0xfe;
    }    
    if (controllers.isControlDown(0, CIDS.SELECT) || 
      controllers.isControlDown(1, CIDS.SELECT)) {
      SWCHB &= 0xfd;
    }    

    // joyButtonPressed
    console.updateControls(SWCHA, SWCHB);
  }

  loadJavatari() {
    const { app } = this;
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      document.body.appendChild(script);
      script.src = 'js/javatari.js';
      script.async = true;
      script.onload = () => {         
        const javatari = window.Javatari;
        if (javatari) {       
          this.javatari =  javatari;

          javatari.audioCallback = (running) => {
            setTimeout(() => app.setShowOverlay(!running), 50);
          };      
          javatari.videoStandardCallback = (std) => {            
            const canvas = document.getElementById('jt-screen-canvas');
            if (canvas) {
              if (std.targetFPS === 50) {
                this.targetFps = 50;
                canvas.classList.add('pal-canvas');
              } else {
                this.targetFps = 60;
                canvas.classList.remove('pal-canvas');
              }
            }
          };    

          let loadingHidden = false;
          let frameCount = 0;          
          javatari.frameCallback = () => {
            // TODO: Debug info (FPS, etc.)

            if (!loadingHidden) {
              // Hack to try to avoid scroll when determining FPS
              if (++frameCount >= (this.targetFps << 1)) {    
                loadingHidden = true;
                this.app.hideLoading();
              }
            }                        
            this.pollControls();
          }

          resolve(javatari);          
        } else {
          reject('An error occurred loading the Atari 2600 module');
        }
      };
    });
  }

  pause(p) {
    const { javatari } = this;
    if ((p && !this.paused) || (!p && this.paused)) {
      this.paused = p;
      javatari.room.console.systemPause(p);
      return true;
    }
    return false;
  }  

  getCart = (blob) => {      
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => {
        reader.abort();
        reject("Error reading cartridge: " + reader.error);
      };
  
      reader.onload = () => {
        const result = reader.result;
        const len = result.length;
        const cart = new Array(len);
        for (let i = 0; i < len; i++) {
          cart[i] = result.charCodeAt(i);
        }
        resolve(cart);
      };
      reader.readAsBinaryString(blob);
    });
  };

  async onStart(screen) {
    const { javatari, romBlob, app, romName } = this;

    // if (this.debug) {
    //   Main.setDebugCallback((dbg) => {
    //     this.debugDiv.innerHTML = dbg;
    //   });
    // }
    try {
      LOG.info(romName);
      const cart = await this.getCart(romBlob);      
      let rom = new window.jt.ROM(romName, cart, null);
      javatari.fileLoader.loadROM(rom, 0, 0, false);
    } catch (e) {
      LOG.error(e);
      app.exit(Resources.getText(TEXT_IDS.ERROR_LOADING_GAME));
    }
  }
}

// TODO: Difficulty switches and black/white

// var SWCHA = 0xff;  // All directions of both controllers OFF
// var SWCHB = 0x0b; // Reset OFF; Select OFF; B/W OFF; Difficult A/B OFF (Amateur)
//   switch (control) {
//     case controls.JOY0_UP:        if (state) SWCHA &= 0xef; else SWCHA |= 0x10; return;	//  0 = Pressed
//     case controls.JOY0_DOWN:      if (state) SWCHA &= 0xdf; else SWCHA |= 0x20; return;
//     case controls.PADDLE1_BUTTON:
//     case controls.JOY0_LEFT:      if (state) SWCHA &= 0xbf; else SWCHA |= 0x40; return;
//     case controls.PADDLE0_BUTTON:
//     case controls.JOY0_RIGHT:     if (state) SWCHA &= 0x7f; else SWCHA |= 0x80; return;
//     case controls.JOY1_UP:        if (state) SWCHA &= 0xfe; else SWCHA |= 0x01; return;
//     case controls.JOY1_DOWN:      if (state) SWCHA &= 0xfd; else SWCHA |= 0x02; return;
//     case controls.JOY1_LEFT:      if (state) SWCHA &= 0xfb; else SWCHA |= 0x04; return;
//     case controls.JOY1_RIGHT:     if (state) SWCHA &= 0xf7; else SWCHA |= 0x08; return;

//     case controls.RESET:          if (state) SWCHB &= 0xfe; else SWCHB |= 0x01; return;
//     case controls.SELECT:         if (state) SWCHB &= 0xfd; else SWCHB |= 0x02; return;
// }
// // Toggles
// if (!state) return;
// switch (control) {
//     case controls.BLACK_WHITE: if ((SWCHB & 0x08) == 0) SWCHB |= 0x08; else SWCHB &= 0xf7;		//	0 = B/W, 1 = Color
//         bus.getTia().getVideoOutput().showOSD((SWCHB & 0x08) != 0 ? "COLOR" : "B/W", true); return;
//     case controls.DIFFICULTY0: if ((SWCHB & 0x40) == 0) SWCHB |= 0x40; else SWCHB &= 0xbf; 		//  0 = Beginner, 1 = Advanced
//         bus.getTia().getVideoOutput().showOSD((SWCHB & 0x40) != 0 ? "P1 Expert" : "P1 Novice", true); return;
//     case controls.DIFFICULTY1: if ((SWCHB & 0x80) == 0) SWCHB |= 0x80; else SWCHB &= 0x7f;		//  0 = Beginner, 1 = Advanced
//         bus.getTia().getVideoOutput().showOSD((SWCHB & 0x80) != 0 ? "P2 Expert" : "P2 Novice", true); return;
