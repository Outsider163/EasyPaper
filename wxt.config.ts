import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: 'EasyPaper',
    description: '在学术检索结果页显示 CCF 与学校期刊、会议等级。',
    permissions: ['storage'],
    action: {
      default_title: 'EasyPaper',
    },
  },
});

