App({
    globalData: {},
  
    onLaunch() {
      // 展示本地存储能力
      const logs = wx.getStorageSync("logs") || [];
      logs.unshift(Date.now());
      wx.setStorageSync("logs", logs);
  
      // 登录
      wx.login({
        success: (res) => {
          console.log(res.code);
          // 发送 res.code 到后台换取 openId, sessionKey, unionId
        },
      });
  
      // 初始化云开发 SDK
      wx.cloud.init({
        traceUser: true,
        env: "tianbx-8gq34ofbfef5c3b4", // 使用你提供的云环境 ID
      });
    },
  });
