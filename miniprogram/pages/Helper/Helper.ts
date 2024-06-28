const app = getApp();

Page({
    data: {
        messages: [
            { isSender: false, message: '你好!欢迎使用 AlzheimerVisitaAid 测试。如果您准备好了，我们可以开始测试。只要说"开始测试"，我们就可以开始。您也可以随时提出任何相关问题。', type: 'text' },
        ],
        inputValue: '',
        scrollToView: '',
        cid: '',
        imagePath: '',
        isWaiting: false,
        isWaitingImage: false
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

        const newMessage = { isSender: true, message, type: 'text' };
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
            data: { prompt: message, cid: this.data.cid },
            success: (res) => {
                if (res.statusCode === 200 && res.data.response) {
                    const newMessages = [];
                    
                    // Add text message first
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

                    // If there's an image being generated, start polling
                    if (res.data.has_image && res.data.image_status === 'generating') {
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
                console.error('请求失败', err);
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
        const newMessage = { isSender: true, type: 'image' };
        this.setData({
            messages: this.data.messages.concat([newMessage]),
        }, () => {
            this.scrollToBottom();
        });
    },
});
