import { WebrcadeApp, FetchAppData, Unzip, UrlUtil } from '@webrcade/app-common'
import { Emulator } from './emulator'

import './App.scss';
import '@webrcade/app-common/dist/index.css'

class App extends WebrcadeApp {
  emulator = null;

  constructor() {
    super();

    this.state.showLoading = true;
    this.state.started = false;
  }

  componentDidMount() {
    super.componentDidMount();

    // Create the emulator
    if (this.emulator === null) {
      this.emulator = new Emulator(this, this.isDebug());
    }

    const { appProps, emulator, ModeEnum } = this;

    // Get the ROM location that was specified
    const rom = appProps.rom;
    if (!rom) throw new Error("A ROM file was not specified."); 
    // Swap controllers
    const swap = appProps.swap;
    if (swap) {
      emulator.setSwapJoysticks(swap);
    }

    emulator.loadJavatari()
      .then(() => new FetchAppData(rom).fetch())    
      .then(response => response.blob())
      .then(blob => new Unzip().unzip(blob, [".a26", ".bin"], [".a26"]))
      .then(blob => emulator.setRom(blob, UrlUtil.getFileName(rom)))
      .then(() => this.setState({ mode: ModeEnum.LOADED }))
      .catch(msg => {
        this.exit("Error fetching ROM: " + msg);
      })
  }

  componentDidUpdate() {
    const { mode, started } = this.state;
    const { ModeEnum, emulator } = this;

    if (mode === ModeEnum.LOADED && !started) {
      this.setState({started: true});

      window.focus();
      // Start the emulator
      emulator.start();                  
    }
  }

  hideLoading() {
    const { jtdiv } = this;

    this.setState({showLoading: false});
    jtdiv.style.display = 'inline-block';
  }

  renderCanvas() {
    return (
      <div id="javatari" ref={(jtdiv) => { this.jtdiv = jtdiv; }}>
        <div id="javatari-screen"></div>
      </div>      
    );
  }

  render() {
    const { showLoading } = this.state;

    return (
      <>
        { showLoading ? this.renderLoading() : null}
        { this.renderCanvas() }
      </>
    );
  }
}

export default App;
