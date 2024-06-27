Page({
    data: {
      userInfo: {},
      hasUserInfo: false,
      canIUseGetUserProfile: false,
    },
  
    onLoad() {
      if (wx.getUserProfile) {
        this.setData({
          canIUseGetUserProfile: true,
        });
      }
    },
  
    onReady() {},
  
    onShow() {},
  
    onHide() {},
  
    onUnload() {},
  
    onPullDownRefresh() {},
  
    onReachBottom() {},
  
    onShareAppMessage() {},
  
    getUserProfile() {
      wx.getUserProfile({
        desc: '用于完善会员资料',
        success: (res) => {
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true,
          });
          console.log(res.userInfo);
        },
      });
    },
  
    getUserInfo(e) {
      this.setData({
        userInfo: e.detail.userInfo,
        hasUserInfo: true,
      });
    },
  
    jumpPage(e) {
      console.log(e.currentTarget.dataset['page']);
      switch (e.currentTarget.dataset['page']) {
        case 'draft':
          wx.navigateTo({
            url: '../../pages/Draft/Draft',
          });
          break;
        case 'help':
          wx.navigateTo({
            url: '../../pages/Helper/Helper',
          });
          break;
        case 'service':
          wx.navigateTo({
            url: '../../pages/Helper/Helper',
          });
          break;
        default:
          break;
      }
    },
  });