import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: 'EasyPaper',
    description: '在学术检索结果页显示 CCF、中科院升级版、JCR、新锐、影响因子、SJR 与学校等级。',
    permissions: ['storage', 'unlimitedStorage'],
    action: {
      default_title: 'EasyPaper',
    },
  },
});

