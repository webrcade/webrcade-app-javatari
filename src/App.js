import {
  romNameScorer,
  setMessageAnchorId,
  settings,
  AppRegistry,
  FetchAppData,
  Resources,
  Unzip,
  UrlUtil,
  WebrcadeApp,
  APP_TYPE_KEYS,
  LOG,
  TEXT_IDS,
} from '@webrcade/app-common';
import { Emulator } from './emulator';
import { EmulatorPauseScreen } from './pause';

import './App.scss';

class App extends WebrcadeApp {
  emulator = null;

  constructor() {
    super();

    this.state.showLoading = true;
    this.state.started = false;
  }

  componentDidMount() {
    super.componentDidMount();

    setMessageAnchorId('jt-screen-canvas');

    // Create the emulator
    if (this.emulator === null) {
      this.emulator = new Emulator(this, this.isDebug());
    }

    const { appProps, emulator, ModeEnum } = this;

    // Determine extensions
    const exts = AppRegistry.instance.getExtensions(
      APP_TYPE_KEYS.JAVATARI,
      true,
      false,
    );
    const extsNotUnique = AppRegistry.instance.getExtensions(
      APP_TYPE_KEYS.JAVATARI,
      true,
      true,
    );

    try {
      // Get the ROM location that was specified
      const rom = appProps.rom;
      if (!rom) throw new Error('A ROM file was not specified.');
      // Swap controllers
      const swap = appProps.swap;
      if (swap) {
        emulator.setSwapJoysticks(swap);
      }

      emulator
        .loadJavatari()
        .then(() => settings.load())
        // .then(() => settings.setBilinearFilterEnabled(true))
        .then(() => new FetchAppData(rom).fetch())
        .then((response) => response.blob())
        .then((blob) =>
          new Unzip()
            .setDebug(this.isDebug())
            .unzip(blob, extsNotUnique, exts, romNameScorer),
        )
        .then((blob) => emulator.setRom(blob, UrlUtil.getFileName(rom)))
        .then(() => this.setState({ mode: ModeEnum.LOADED }))
        .catch((msg) => {
          LOG.error(msg);
          this.exit(
            this.isDebug()
              ? msg
              : Resources.getText(TEXT_IDS.ERROR_RETRIEVING_GAME),
          );
        });
    } catch (e) {
      this.exit(e);
    }
  }

  componentDidUpdate() {
    const { mode, started } = this.state;
    const { emulator, ModeEnum } = this;

    if (mode === ModeEnum.LOADED && !started) {
      this.setState({ started: true });

      window.focus();
      // Start the emulator
      emulator.start(this.screen);
    }
  }

  hideLoading() {
    const { jtdiv } = this;

    this.setState({ showLoading: false });
    jtdiv.style.display = 'inline-block';
  }

  renderPauseScreen() {
    const { appProps, emulator } = this;

    return (
      <EmulatorPauseScreen
        emulator={emulator}
        appProps={appProps}
        closeCallback={() => this.resume()}
        exitCallback={() => this.exit()}
        isEditor={this.isEditor}
      />
    );
  }

  renderCanvas() {
    return (
      <div
        id="javatari"
        ref={(jtdiv) => {
          this.jtdiv = jtdiv;
        }}
      >
        <div
          ref={(screen) => {
            this.screen = screen;
          }}
          id="javatari-screen"
        ></div>
      </div>
    );
  }

  render() {
    const { ModeEnum } = this;
    const { mode, showLoading } = this.state;

    return (
      <>
        {super.render()}
        {mode === ModeEnum.PAUSE ? this.renderPauseScreen() : null}
        {showLoading && mode !== ModeEnum.ERROR ? this.renderLoading() : null}
        {this.renderCanvas()}
      </>
    );
  }
}

export default App;
