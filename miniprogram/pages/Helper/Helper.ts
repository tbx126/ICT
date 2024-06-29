const app = getApp<IAppOption>();

interface Message {
  isSender: boolean;
  message?: string;
  type: 'text' | 'image';
  imgUrl?: string;
  retryCount?: number;
}

interface PageData {
  messages: Message[];
  inputValue: string;
  scrollToView: string;
  cid: string;
  isWaiting: boolean;
  isWaitingImage: boolean;
  retryCount: number;
  typingMessage: string;
  isTyping: boolean;
  tempImagePath?: string;
  audioContext: WechatMiniprogram.InnerAudioContext | null;
  isAudioPlaying: boolean;
}

Page<PageData>({
  data: {
    messages: [
      { isSender: false, message: '你好!欢迎使用 AlzheimerVisitaAid 测试。如果您准备好了，我们可以开始测试。只要说"开始测试"，我们就可以开始。您也可以随时提出任何相关问题。', type: 'text' },
    ],
    inputValue: '',
    scrollToView: '',
    cid: '',
    isWaiting: false,
    isWaitingImage: false,
    isAudioPlaying: false,
    retryCount: 0,
    typingMessage: '',
    isTyping: false,
    audioContext: null as WechatMiniprogram.InnerAudioContext | null,
  },

  onLoad: function() {
    this.scrollToBottom();
    this.setData({
      audioContext: wx.createInnerAudioContext()
    });
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({
      inputValue: e.detail.value,
    });
  },

  scrollToBottom() {
    const messages = this.data.messages;
    if (messages.length > 0) {
      this.setData({
        scrollToView: `msg${messages.length - 1}`
      });
    }
  },

  onSend() {
    const message = this.data.inputValue.trim();
    if (!message) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none'
      });
      return;
    }

    this.sendInput('text', message);
  },

  sendInput(inputType: 'text' | 'image', inputContent: string) {
    const newMessage: Message = { 
      isSender: true, 
      message: inputContent, 
      type: inputType
    };

    if (inputType === 'image') {
      newMessage.imgUrl = this.data.tempImagePath;
    }

    this.setData({
      messages: [...this.data.messages, newMessage],
      inputValue: '',
      isWaiting: true
    }, () => {
      this.scrollToBottom();
    });

    wx.request({
      url: 'https://d7d8-222-129-200-164.ngrok-free.app/create',
      method: 'POST',
      data: { 
        input_type: inputType,
        input_content: inputContent,
        cid: this.data.cid
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.response) {
          this.setData({
            isTyping: true,
            typingMessage: '',
            cid: res.data.cid,
            isWaiting: false
          });
          
          // Play audio
          if (res.data.audio_base64) {
            this.playAudio(res.data.audio_base64);
          }
          
          this.typeMessage(res.data.response);

          if (res.data.need_generate_image && res.data.image_status === 'generating') {
            console.log('Image generation started, beginning to poll');
            this.pollForImage();
          } else {
            console.log('No image to generate or unexpected image status');
          }
        } else {
          console.log('Unexpected server response');
          const errorMessage: Message = { isSender: false, message: '服务器返回错误', type: 'text' };
          this.setData({
            messages: [...this.data.messages, errorMessage],
            isWaiting: false
          }, () => {
            this.scrollToBottom();
          });
        }
      },
      fail: (err) => {
        console.error('Request failed:', err);
        wx.showToast({
          title: '请求失败，请重试',
          icon: 'none'
        });
        const errorMessage: Message = { isSender: false, message: '请求失败，请重试', type: 'text' };
        this.setData({
          messages: [...this.data.messages, errorMessage],
          isWaiting: false
        }, () => {
          this.scrollToBottom();
        });
      }
    });
  },

  playAudio(audioBase64: string) {
    console.log('Received audio base64:', audioBase64);
    const audioSrc = `data:audio/mp3;base64,${audioBase64}`;
    if (this.data.audioContext) {
      this.data.audioContext.src = audioSrc;
      
      this.data.audioContext.onError((res) => {
        console.error('Audio play error:', res.errMsg);
        this.setData({ isAudioPlaying: false });
      });
  
      this.data.audioContext.onCanplay(() => {
        console.log('Audio is ready to play');
        this.data.audioContext?.play();
      });
  
      this.data.audioContext.onPlay(() => {
        console.log('Audio started playing');
        this.setData({ isAudioPlaying: true });
      });
  
      this.data.audioContext.onEnded(() => {
        console.log('Audio finished playing');
        this.setData({ isAudioPlaying: false });
      });
  
    } else {
      console.error('audioContext is not initialized');
    }
  },
  

  typeMessage(message: string, index: number = 0) {
    if (index < message.length) {
      this.setData({
        typingMessage: this.data.typingMessage + message[index]
      });
      setTimeout(() => {
        this.typeMessage(message, index + 1);
      }, 50);
    } else {
      const newMessage: Message = { 
        isSender: false, 
        message: this.data.typingMessage, 
        type: 'text'
      };
      this.setData({
        messages: [...this.data.messages, newMessage],
        isTyping: false,
        typingMessage: ''
      }, () => {
        this.scrollToBottom();
      });
  
      // 检查音频是否仍在播放
      if (!this.data.isAudioPlaying) {
        // 如果音频已经停止，则停止音频上下文
        if (this.data.audioContext) {
          this.data.audioContext.stop();
        }
      }
    }
  },  

  pollForImage(retries: number = 30, interval: number = 2000) {
    let count = 0;
    const checkImage = () => {
      console.log(`Checking image status, attempt ${count + 1}`);
      if (count >= retries) {
        console.log('Image generation timed out');
        this.setData({ isWaitingImage: false });
        return;
      }
      wx.request({
        url: `https://d7d8-222-129-200-164.ngrok-free.app/check_image?cid=${this.data.cid}`,
        method: 'GET',
        header: {
          'ngrok-skip-browser-warning': 'true'
        },
        success: (res) => {
          console.log('Image status response:', res.data);
          if (res.statusCode === 200) {
            let data: any;
            if (typeof res.data === 'string') {
              try {
                data = JSON.parse(res.data);
              } catch (e) {
                console.error('Failed to parse response as JSON:', e);
                count++;
                setTimeout(checkImage, interval);
                return;
              }
            } else {
              data = res.data;
            }

            if (data.image_status === 'ready') {
              console.log('Image is ready:', data.image_url);
              const imageMessage: Message = {
                isSender: false,
                imgUrl: data.image_url,
                type: 'image'
              };
              this.setData({
                messages: [...this.data.messages, imageMessage],
                isWaitingImage: false
              }, () => {
                console.log('Image message added to chat');
                this.scrollToBottom();
              });
            } else if (data.image_status === 'failed') {
              console.log('Image generation failed');
              this.setData({
                isWaitingImage: false
              });
            } else {
              console.log('Image still generating, will check again');
              count++;
              setTimeout(checkImage, interval);
            }
          } else {
            console.log('Unexpected status code:', res.statusCode);
            count++;
            setTimeout(checkImage, interval);
          }
        },
        fail: (err) => {
          console.error('Error checking image status:', err);
          count++;
          setTimeout(checkImage, interval);
        }
      });
    };
    console.log('Starting to poll for image');
    this.setData({ isWaitingImage: true });
    checkImage();
  },    

  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        
        this.setData({
          tempImagePath: tempFilePath
        });

        wx.getFileSystemManager().readFile({
          filePath: tempFilePath,
          encoding: 'base64',
          success: (res) => {
            const base64Data = res.data as string;
            this.sendInput('image', base64Data);
          },
          fail: (err) => {
            console.error('Failed to read image file:', err);
            wx.showToast({
              title: '读取图片失败',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        console.error('Failed to choose image:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },
  
  isValidBase64Format(str: string): boolean {
    if (str === '' || str.trim() === '') { return false; }
    return /^[A-Za-z0-9+/]*={0,2}$/.test(str);
  },
  
  previewImage(e: WechatMiniprogram.TouchEvent) {
    const src = e.currentTarget.dataset.src as string;
    wx.previewImage({
      current: src,
      urls: [src]
    });
  },    

  onImageError(e: WechatMiniprogram.TouchEvent) {
    const index = e.currentTarget.dataset.index as number;
    const retryCount = (e.currentTarget.dataset.retryCount as number) || 0;
    
    if (retryCount < 3) {
      setTimeout(() => {
        const messages = this.data.messages;
        messages[index].retryCount = retryCount + 1;
        messages[index].imgUrl = messages[index].imgUrl + '?t=' + new Date().getTime();
        this.setData({ messages: messages });
      }, 1000);
    } else {
      console.error('Failed to load image after 3 retries');
      wx.showToast({
        title: '图片加载失败',
        icon: 'none'
      });
    }
  },    
});
