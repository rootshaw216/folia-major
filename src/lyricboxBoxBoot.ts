// src/lyricboxBoxBoot.ts
// LyricBox：在 bootstrap 最先导入，早于各 store 读取本地存储。只在电视盒子播放器里生效（utils/lyricboxBox.ts）。
import { applyBoxStartupDefaults } from './utils/lyricboxBox';

applyBoxStartupDefaults(typeof localStorage !== 'undefined' ? localStorage : null);
