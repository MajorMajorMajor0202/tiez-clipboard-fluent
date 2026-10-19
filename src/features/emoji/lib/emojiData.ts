export type EmojiGroup = { name: string; emojis: string[] };

export type EmojiDictEntry = {
  zh: { name: string; keywords: string[] };
  tc: { name: string; keywords: string[] };
  en: { name: string; keywords: string[] };
};

type EmojiData = {
  groups: EmojiGroup[];
  dictionary: Record<string, EmojiDictEntry>;
};

let cachedData: EmojiData | undefined;
let pendingData: Promise<EmojiData> | undefined;

export const getCachedEmojiData = () => cachedData;

export const loadEmojiData = (): Promise<EmojiData> => {
  if (cachedData) return Promise.resolve(cachedData);
  if (pendingData) return pendingData;

  pendingData = fetch("/emoji-data.json")
    .then(async (response) => {
      if (!response.ok) throw new Error("Failed to load emoji data");
      const data = await response.json();
      const groups = Array.isArray(data?.groups)
        ? data.groups.filter((group: EmojiGroup) => group && Array.isArray(group.emojis))
        : [];
      if (groups.length === 0) throw new Error("Invalid emoji data");
      cachedData = { groups, dictionary: data.dictionary ?? {} };
      return cachedData;
    })
    .finally(() => {
      pendingData = undefined;
    });

  return pendingData;
};
