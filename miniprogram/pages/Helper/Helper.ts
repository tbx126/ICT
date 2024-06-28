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

                    // Add image message if there's an image
                    if (res.data.has_image && res.data.image_url) {
                        const imageMessage = {
                            isSender: false,
                            imgUrl: res.data.image_url,
                            type: 'image'
                        };
                        this.setData({
                            messages: this.data.messages.concat([imageMessage]),
                        }, () => {
                            this.scrollToBottom();
                        });
                    }
                } else {
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

    chooseImage() {
        const newMessage = { isSender: true, type: 'image' };
        this.setData({
            messages: this.data.messages.concat([newMessage]),
        }, () => {
            this.scrollToBottom();
        });
    },
});
