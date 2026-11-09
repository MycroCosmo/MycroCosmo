export type ThemeName = 'light' | 'dark';

export interface Theme {
  bg: string;
  border: string;
  divider: string;
  title: string;
  muted: string;
  accent: string;
  chipBg: string;
  thumbBg: string;
}

// 시안(Design 캔버스)과 같은 값. 텍스트 대비는 배경 대비 4.5:1 이상으로 맞춰 둠.
export const THEMES: Record<ThemeName, Theme> = {
  light: {
    bg: '#FFFFFF',
    border: '#D9D6CF',
    divider: '#ECEAE5',
    title: '#1F2328',
    muted: '#59636E',
    accent: '#C2410C',
    chipBg: '#FFF1E8',
    thumbBg: '#F3F1EC',
  },
  dark: {
    bg: '#0D1117',
    border: '#30363D',
    divider: '#21262D',
    title: '#E6EDF3',
    muted: '#9198A1',
    accent: '#F0883E',
    chipBg: '#2D1E12',
    thumbBg: '#1C2129',
  },
};

export const FONT_FAMILY =
  "'Pretendard','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR','Noto Sans CJK KR',system-ui,sans-serif";

export function pickTheme(value: string | null): ThemeName {
  return value === 'dark' ? 'dark' : 'light';
}
