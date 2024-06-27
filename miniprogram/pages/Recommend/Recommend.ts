// pages/welcome/welcome.js
Page({

    /**
     * 页面的初始数据
     */
    data: {
        userInfo:{},
        animationData:{},
        actionSheetHidden: true,
        actionSheetItems:[
         
            ],
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {

    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {

    },
    chatWithMe: function(e){
        // console.log('dfdf')
         wx.switchTab({
           url: '../Helper/Helper'
         })
     },
     actionSheetChange: function(e){
         this.setData({
             actionSheetHidden: !this.data.actionSheetHidden
         })
     },
     bindItemTap: function (e){
          console.log('tap ' + e.currentTarget.dataset.navigator);
          wx.navigateTo({
             url: e.currentTarget.dataset.navigator
         })
     },
     onShow: function () {
         let that = this;
         app.getUserInfo(function(userInfo){
             that.setData({
                 userInfo:userInfo
                 })
         })
         wx.setNavigationBarTitle({
             title: '主页',
             success:function(){
                // console.log("success")
             },
             fail: function(){
                // console.log("error")
             }
         })
         wx.showNavigationBarLoading();
         var animation = wx.createAnimation({
             transformOrigin: "50% 50%",
             duration: 3000,
             timingFunction: 'ease',
             delay: 0
         })
         this.animation = animation;
         animation.scale(2,2).rotate(45).step();
         this.setData({
             animationData: animation.export()
         })
         setTimeout(function(){
             animation.translate(30).step();
             this.setData({
                 animationData:animation.export()
             })
         }.bind(this),2000)
     }
})