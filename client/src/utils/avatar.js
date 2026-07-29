// Bảng màu avatar — cùng dải màu với User.color ở backend
const AVATAR_COLORS = [
  '#1db954',
  '#e8115b',
  '#7358ff',
  '#f59b23',
  '#148a08',
  '#0d73ec',
  '#af2896',
  '#b02897',
];

// Hash ổn định: cùng một tên luôn ra cùng một màu, không cần lưu đâu cả
export const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

export const getInitials = (name) => {
  if (!name) return '?';

  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2);

  return `${words[0][0]}${words[words.length - 1][0]}`;
};
