import React, { Component } from 'react';

import {
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Share,
  ToastAndroid } from 'react-native';
  
import Slider from '@react-native-community/slider';
  
import { Player, Recorder, MediaStates } from '@react-native-community/audio-toolkit';

import * as RNFS from 'react-native-fs';

async function requestSavePermission() {
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Voux Save Permission',
        message:
          'Voux needs access to your storage' +
          'so you can save your recordings!',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('Granted');

      const path = RNFS.ExternalStorageDirectoryPath + '/' + filename;

      RNFS.writeFile(path, filename, 'utf8')
        .then((success) => {
          console.log('FILE WRITTEN!');
        })
        .catch((err) => {
          console.log(err.message);
        });

      ToastAndroid.show('File saved to /storage/emulated/0/audio.mp4', ToastAndroid.SHORT);
 
    } else {
      console.log('Denied');
    }
  } catch (err) {
    console.warn(err);
  }
}

const filename = 'audio.mp4';

function saveFile() {
  requestSavePermission();

}    
 
type Props = {};

type State = {
  playPauseButton: string,
  recordButton: string,

  stopButtonDisabled: boolean,
  playButtonDisabled: boolean,
  recordButtonDisabled: boolean,

  loopButtonStatus: boolean,
    progress: number,

  error: string | null
};

  export default class Core extends Component<Props, State> {
    player: Player | null;
    recorder: Recorder | null;
    lastSeek: number;
    _progressInterval: IntervalID;

    constructor(props: Props) {
      super(props);

      this.state = {
        playPauseButton: 'Preparing...',
        recordButton: 'Preparing...',

        stopButtonDisabled: true,
        playButtonDisabled: true,
        recordButtonDisabled: true,

        loopButtonStatus: false,
        progress: 0,

        error: null
      };
    }

    componentWillMount() {
      this.player = null;
      this.recorder = null;
      this.lastSeek = 0;

      this._reloadPlayer();
      this._reloadRecorder();

      this._progressInterval = setInterval(() => {
        if (this.player && this._shouldUpdateProgressBar()) {
          let currentProgress = Math.max(0, this.player.currentTime) / this.player.duration;
          if (isNaN(currentProgress)) {
            currentProgress = 0;
          }
          this.setState({ progress: currentProgress });
        }
      }, 100);
    }

    componentWillUnmount() {
      clearInterval(this._progressInterval);
    }

    _shouldUpdateProgressBar() {
      // Debounce progress bar update by 200 ms
      return Date.now() - this.lastSeek > 200;
    }

    _updateState(err) {
      this.setState({
        playPauseButton: this.player && this.player.isPlaying ? '।।' : 'ᐅ',
        recordButton: this.recorder && this.recorder.isRecording ? '■' : '•',

        stopButtonDisabled: !this.player || !this.player.canStop,
        playButtonDisabled: !this.player || !this.player.canPlay || this.recorder.isRecording,
        recordButtonDisabled: !this.recorder || (this.player && !this.player.isStopped),
      });
    }

    _playPause() {
      this.player.playPause((err, paused) => {
        if (err) {
          this.setState({
            error: err.message
          });
        }
        this._updateState();
      });
    }

    _stop() {
      this.player.stop(() => {
        this._updateState();
      });
    }

    _seek(percentage) {
      if (!this.player) {
        return;
      }

      this.lastSeek = Date.now();

      let position = percentage * this.player.duration;

      this.player.seek(position, () => {
        this._updateState();
      });
    }

    _reloadPlayer() {
      if (this.player) {
        this.player.destroy();
      }

      this.player = new Player(filename, {
        autoDestroy: false
      }).prepare((err) => {
        if (err) {
          console.log('error at _reloadPlayer():');
          console.log(err);
        } else {
          this.player.looping = this.state.loopButtonStatus;
        }

        this._updateState();
      });

      this._updateState();

      this.player.on('ended', () => {
        this._updateState();
      });
      this.player.on('pause', () => {
        this._updateState();
      });
    }

    _reloadRecorder() {
      if (this.recorder) {
        this.recorder.destroy();
      }

      this.recorder = new Recorder(filename, {
        bitrate: 256000,
        channels: 2,
        sampleRate: 44100,
        quality: 'max'
      });

      this._updateState();
    }

    _toggleRecord() {
      if (this.player) {
        this.player.destroy();
      }

      let recordAudioRequest;
      if (Platform.OS == 'android') {
        recordAudioRequest = this._requestRecordAudioPermission();
      } else {
        recordAudioRequest = new Promise(function (resolve, reject) { resolve(true); });
      }

      recordAudioRequest.then((hasPermission) => {
        if (!hasPermission) {
          this.setState({
            error: 'Record Audio Permission was denied'
          });
          return;
        }

        this.recorder.toggleRecord((err, stopped) => {
          if (err) {
            this.setState({
              error: err.message
            });
          }
          if (stopped) {
            this._reloadPlayer();
            this._reloadRecorder();
          }

          this._updateState();
        });
      });
    }

    async _requestRecordAudioPermission() {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Voux needs access to your microphone to start recording',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return true;
        } else {
          return false;
        }
      } catch (err) {
        console.error(err);
        return false;
      }
    }

    _toggleLooping(value) {
      this.setState({
        loopButtonStatus: value
      });
      if (this.player) {
        this.player.looping = value;
      }
    }

    render() {
      return (
        <>
          <SafeAreaView style={styles.container}>
            <View>
              <TouchableOpacity style={styles.btn} title={this.state.recordButton} disabled={this.state.recordButtonDisabled} onPress={() => this._toggleRecord()}>
                <Text style={styles.btnText}>{this.state.recordButton}</Text>
              </TouchableOpacity>
            </View>
            <View>
              <TouchableOpacity style={styles.pbtn} title={this.state.playPauseButton} disabled={this.state.playButtonDisabled} onPress={() => this._playPause()}>
                <Text style={styles.pBtnText}>{this.state.playPauseButton}</Text>
              </TouchableOpacity>
            </View>
            <View>
              <Text style={styles.errorMessage}>{this.state.error}</Text>
            </View>
            <View>
              <Slider
                style={styles.slider}
                thumbTintColor='#fff'
                step={0.0001}
                disabled={this.state.playButtonDisabled}
                onValueChange={(percentage) => this._seek(percentage)}
                value={this.state.progress}
                minimumTrackTintColor='#fff'
                maximumTrackTintColor='#fff'/>
            </View>
            <View>
              <TouchableOpacity style={styles.sbtn} onPress={() => requestSavePermission()}>
                <Text style={styles.btnText}>⤓</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </>
      );
    }
  }

  const styles = StyleSheet.create({
    slider: {
      width: 150
    },
    btn: {
      borderColor: '#fff',
      borderWidth: 1,
      borderRadius: 4,
      width: 150,
      height: 50,
      justifyContent: 'center',
      marginBottom: 20
    },

    sbtn: {
      borderColor: '#fff',
      borderWidth: 1,
      borderRadius: 4,
      width: 150,
      height: 50,
      justifyContent: 'center',
      marginTop: 40
    },

    pbtn: {
      borderColor: '#fff',
      borderWidth: 1,
      borderRadius: 4,
      width: 150,
      height: 100,
      justifyContent: 'center',
    },
    btnText: {
      color: '#fff',
      textAlign: 'center',
      fontWeight: '100',
      fontSize: 20
    },
    pBtnText: {
      color: '#fff',
      textAlign: 'center',
      fontWeight: '100',
      fontSize: 20
    },
    settingsContainer: {
      alignItems: 'center',
      color: '#fff'
    },
    container: {
      flex: 1,
      backgroundColor: '#000',
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorMessage: {
      fontSize: 15,
      textAlign: 'center',
      padding: 10,
      color: 'red'
    }
  });
