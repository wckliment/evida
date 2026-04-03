import { diffWords } from "diff";

export function getHighlightedDiff(oldText: string, newText: string) {
  const diff = diffWords(oldText, newText);

  return diff
    .map((part) => {
      if (part.added) {
        return `<span class="bg-green-500/20 text-green-300">${part.value}</span>`;
      }

      return part.value;
    })
    .join("");
}
