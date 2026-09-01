import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: 'EasyPaper',
    description:
      '自动识别论文来源并显示 CCF、学校目录和可选在线学术评价标签。',
    permissions: ['storage', 'unlimitedStorage', 'alarms'],
    host_permissions: [
      'https://raw.githubusercontent.com/Outsider163/EasyPaper/*',
    ],
    action: {
      default_title: 'EasyPaper',
    },
  },
});

