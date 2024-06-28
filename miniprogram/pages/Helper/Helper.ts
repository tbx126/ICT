const app = getApp();

Page({
    data: {
        messages: [
            { isSender: false, message: '你好!欢迎使用 AlzheimerVisitaAid 测试。如果您准备好了，我们可以开始测试。只要说"开始测试"，我们就可以开始。您也可以随时提出任何相关问题。', type: 'text' },
        ],
        inputValue: '',
        scrollToView: '',
        cid: '',
        isWaiting: false,
        isWaitingImage: false,
        retryCount: 0
    },

    onLoad: function() {
        this.scrollToBottom();
    },

    onInput(e) {
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

    sendInput(inputType, inputContent) {
        const newMessage = { 
            isSender: true, 
            message: inputContent, 
            type: inputType
        };

        if (inputType === 'image') {
            newMessage.imgUrl = this.data.tempImagePath;
        }

        this.setData({
            messages: this.data.messages.concat([newMessage]),
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
                    const newMessages = [];
                    
                    newMessages.push({ 
                        isSender: false, 
                        message: res.data.response, 
                        type: 'text'
                    });
                    
                    this.setData({
                        messages: this.data.messages.concat(newMessages),
                        cid: res.data.cid,
                        isWaiting: false
                    }, () => {
                        this.scrollToBottom();
                    });

                    if (res.data.need_generate_image && res.data.image_status === 'generating') {
                        console.log('Image generation started, beginning to poll');
                        this.pollForImage();
                    } else {
                        console.log('No image to generate or unexpected image status');
                    }
                } else {
                    console.log('Unexpected server response');
                    const errorMessage = { isSender: false, message: '服务器返回错误', type: 'text' };
                    this.setData({
                        messages: this.data.messages.concat([errorMessage]),
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
                const errorMessage = { isSender: false, message: '请求失败，请重试', type: 'text' };
                this.setData({
                    messages: this.data.messages.concat([errorMessage]),
                    isWaiting: false
                }, () => {
                    this.scrollToBottom();
                });
            }
        });
    },

    pollForImage(retries = 30, interval = 2000) {
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
                        let data;
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
                            const imageMessage = {
                                isSender: false,
                                imgUrl: data.image_url,
                                type: 'image'
                            };
                            this.setData({
                                messages: this.data.messages.concat([imageMessage]),
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
                
                // 立即显示图片
                this.setData({
                    tempImagePath: tempFilePath
                });
    
                // 读取文件并转换为base64
                wx.getFileSystemManager().readFile({
                    filePath: tempFilePath,
                    encoding: 'base64',
                    success: (res) => {
                        const base64Data = res.data;
                        // 发送base64数据到后端
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
    
    // 新的辅助函数来检查base64字符串的基本格式
    isValidBase64Format(str) {
        if (str === '' || str.trim() === '') { return false; }
        // 检查字符串是否只包含合法的base64字符
        return /^[A-Za-z0-9+/]*={0,2}$/.test(str);
    },
    
    previewImage(e) {
        const src = e.currentTarget.dataset.src;
        wx.previewImage({
            current: src,
            urls: [src]
        });
    },    

    onImageError(e) {
        const index = e.currentTarget.dataset.index;
        const retryCount = e.currentTarget.dataset.retryCount || 0;
        
        if (retryCount < 3) {
            setTimeout(() => {
                const messages = this.data.messages;
                messages[index].retryCount = retryCount + 1;
                // 强制刷新图片
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