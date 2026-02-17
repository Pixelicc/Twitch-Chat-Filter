const style = document.createElement('style');
style.textContent = `
  .blocked-by-twitch-chat-filter {
    display: none !important;
  }
`;
document.head.appendChild(style);

let blockedWords = [];
let globalFilters = {
  blockAscii: false,
};

const updateStats = (filter) => {
  if (!filter) return;
  chrome.storage.local.get(['stats'], (result) => {
    const stats = result.stats || {};
    stats[filter] = (stats[filter] || 0) + 1;
    chrome.storage.local.set({ stats });
  });
};

const isAsciiArt = (text) => {
  const nonAsciiRatio = text.replace(/[a-zA-Z0-9\s]/g, '').length / text.length;
  return nonAsciiRatio > 0.5;
};

const checkAndApplyBlocking = (element) => {
  const messageBody = element.querySelector('[data-a-target="chat-line-message-body"], .seventv-chat-message-body');
  const messageText = (messageBody || { textContent: "" }).textContent.trim();
  const lowerCaseMessageText = messageText.toLowerCase();
  let triggeredFilter = null;

  let isBlockedByGlobalFilter = false;
  if (globalFilters.blockAscii && isAsciiArt(messageText)) {
    isBlockedByGlobalFilter = true;
    triggeredFilter = 'ASCII Art';
  }

  const activeBlockedWords = blockedWords.filter(item => item.enabled !== false);

  let hasTextMatch = false;
  if (lowerCaseMessageText) {
    hasTextMatch = activeBlockedWords.some((item) => {
      if (lowerCaseMessageText.includes(item.word.toLowerCase())) {
        if (!isBlockedByGlobalFilter) {
          triggeredFilter = item.word;
        }
        return true;
      }
      return false;
    });
  }

  let hasEmoteMatch = false;
  const emotes = element.querySelectorAll('img.chat-image, img.seventv-chat-emote');
  for (const emote of emotes) {
    const emoteAlt = emote.alt.toLowerCase();
    if (activeBlockedWords.some(item => {
      if (emoteAlt.includes(item.word.toLowerCase())) {
        if (!isBlockedByGlobalFilter && !hasTextMatch) {
            triggeredFilter = item.word;
        }
        return true;
      }
      return false;
    })) {
      hasEmoteMatch = true;
      break;
    }
  }

  const isBlocked = isBlockedByGlobalFilter || hasTextMatch || hasEmoteMatch;

  let lineToBlock = null;
  if (element.matches('.chat-line__message')) {
    lineToBlock = element.closest('.chat-line__message-container');
  } else if (element.matches('.seventv-message')) {
    lineToBlock = element;
  }

  const wasBlocked = lineToBlock && lineToBlock.classList.contains('blocked-by-twitch-chat-filter');

  if (isBlocked && !wasBlocked) {
    const fullMessageText = element.textContent.trim();
    const lineContainer = element.closest('.chat-line__message-container, .seventv-message');
    const userRaw = lineContainer?.querySelector('.chat-author__display-name, [data-a-target="chat-message-username"], .seventv-chat-user-username');
    let user = userRaw ? userRaw.textContent : null;
    let messageForLog = fullMessageText;
    const messageBodyRaw = element.querySelector('[data-a-target="chat-line-message-body"]');
    if (messageBodyRaw) {
      messageForLog = messageBodyRaw.textContent.trim();
    }

    if (!user) {
      let textToParse = fullMessageText;
      const timeMatch = textToParse.match(/^\d{1,2}:\d{2}/);
      if (timeMatch) {
        textToParse = textToParse.substring(timeMatch[0].length);
      }
      const userMatch = textToParse.match(/^(\w+):/);
      if (userMatch) {
        user = userMatch[1];
        if (!messageBodyRaw) {
          messageForLog = textToParse.substring(userMatch[0].length).trim();
        }
      } else {
        user = 'Unknown User';
      }
    }
    console.log(`[Twitch Chat Filter] blocked,filter=${triggeredFilter},user=${user},message=${messageForLog}`);
    updateStats(triggeredFilter);
    if (lineToBlock) {
        lineToBlock.classList.add('blocked-by-twitch-chat-filter');
    }
  } else if (!isBlocked && wasBlocked) {
    if (lineToBlock) {
        lineToBlock.classList.remove('blocked-by-twitch-chat-filter');
    }
  }
};

const scanAndApplyBlockingToAllMessages = () => {
  const messages = document.querySelectorAll(
    '.chat-line__message, .seventv-message'
  );
  messages.forEach(checkAndApplyBlocking);
};

const loadSettings = () => {
  chrome.storage.local.get(['blockedWords', 'blockAscii'], (result) => {
    blockedWords = result.blockedWords || [];
    globalFilters.blockAscii = result.blockAscii || false;
    scanAndApplyBlockingToAllMessages();
  });
};

loadSettings();

chrome.storage.onChanged.addListener((changes) => {
  let settingsChanged = false;
  if (changes.blockedWords) {
    blockedWords = changes.blockedWords.newValue || [];
    settingsChanged = true;
  }
  if (changes.blockAscii) {
    globalFilters.blockAscii = changes.blockAscii.newValue || false;
    settingsChanged = true;
  }

  if (settingsChanged) {
    scanAndApplyBlockingToAllMessages();
  }
});

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.matches('.chat-line__message, .seventv-message')) {
        checkAndApplyBlocking(node);
      }
      const messages = node.querySelectorAll(
        '.chat-line__message, .seventv-message'
      );
      messages.forEach(checkAndApplyBlocking);
    });
  });
});

observer.observe(document.body, { childList: true, subtree: true });


