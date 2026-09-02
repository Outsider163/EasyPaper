import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: 'EasyPaper',
    description:
      '自动识别论文来源并显示 CCF、学校、中科院、中文核心等学术评价标签。',
    permissions: ['storage', 'unlimitedStorage', 'alarms'],
    host_permissions: [
      'https://cdn.jsdelivr.net/gh/Outsider163/EasyPaper@main/*',
      'https://raw.githubusercontent.com/Outsider163/EasyPaper/*',
    ],
    action: {
      default_title: 'EasyPaper',
    },
  },
});

