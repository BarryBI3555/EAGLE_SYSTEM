export default {
  data() {
    return {
      currentDateTime: '', // 存储格式化后的日期时间
      timer: null          // 定时器引用
    };
  },
  mounted() {
    this.updateDateTime();      // 立即更新一次
    this.timer = setInterval(this.updateDateTime, 1000); // 每秒刷新
  },
  beforeDestroy() {
    if (this.timer) clearInterval(this.timer); // 组件销毁时清除定时器
  },
  methods: {
    updateDateTime() {
      const now = new Date();
      // 示例格式：2025-03-18 14:35:06
      const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      this.currentDateTime = formatted;
    }
  }
};