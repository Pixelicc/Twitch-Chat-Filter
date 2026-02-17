document.addEventListener('DOMContentLoaded', () => {
  const wordInput = document.getElementById('word-input');
  const addWordBtn = document.getElementById('add-word-btn');
  const blockedWordsList = document.getElementById('blocked-words-list');

  // Page switching
  const blocklistBtn = document.getElementById('blocklist-btn');
  const statsBtn = document.getElementById('stats-btn');
  const blocklistPage = document.getElementById('blocklist-page');
  const statsPage = document.getElementById('stats-page');
  const customWordsStatsList = document.getElementById('custom-words-stats');
  const globalFiltersStatsList = document.getElementById('global-filters-stats');

  // Global Filter Checkboxes
  const blockAsciiCheckbox = document.getElementById('block-ascii');

  const globalFilters = {
    blockAscii: blockAsciiCheckbox,
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderBlockedWords = (words) => {
    blockedWordsList.innerHTML = '';
    words.forEach((item) => {
      const li = document.createElement('li');
      const addedDate = formatDate(item.addedAt);
      li.innerHTML = `
        <div class="word-info">
          <span class="word">${item.word}</span>
          <span class="added-date">${addedDate}</span>
        </div>
        <div class="details">
          <div class="toggle-switch">
            <input type="checkbox" id="toggle-${item.word}" class="toggle-word" data-word="${item.word}" ${item.enabled !== false ? 'checked' : ''}>
          </div>
          <button class="remove-btn" data-word="${item.word}">Remove</button>
        </div>
      `;
      blockedWordsList.appendChild(li);
    });

    document.querySelectorAll('.remove-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const wordToRemove = e.target.getAttribute('data-word');
            chrome.storage.local.get(['blockedWords', 'stats'], (result) => {
                const newWords = result.blockedWords.filter((item) => item.word !== wordToRemove);
                const newStats = result.stats || {};
                delete newStats[wordToRemove];
                chrome.storage.local.set({ blockedWords: newWords, stats: newStats });
            });
        });
    });

    document.querySelectorAll('.toggle-word').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const wordToToggle = e.target.getAttribute('data-word');
            const isEnabled = e.target.checked;
            chrome.storage.local.get(['blockedWords'], (result) => {
                const newWords = result.blockedWords.map(item => {
                    if (item.word === wordToToggle) {
                        return { ...item, enabled: isEnabled };
                    }
                    return item;
                });
                chrome.storage.local.set({ blockedWords: newWords });
            });
        });
    });
  };

  const renderStats = (stats, words) => {
    customWordsStatsList.innerHTML = '';
    const customWordsStats = words.reduce((acc, item) => {
        acc[item.word] = stats[item.word] || 0;
        return acc;
    }, {});

    if (Object.keys(customWordsStats).length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.classList.add('stats-item');
        emptyLi.innerHTML = '<span class="stats-item-label">No custom words added yet</span>';
        customWordsStatsList.appendChild(emptyLi);
    } else {
        for (const filter in customWordsStats) {
            const li = document.createElement('li');
            li.classList.add('stats-item');
            li.innerHTML = `
                <span class="stats-item-label">${filter}</span>
                <span class="stats-item-count">${customWordsStats[filter]}</span>
            `;
            customWordsStatsList.appendChild(li);
        }
    }

    globalFiltersStatsList.innerHTML = '';
    const globalFiltersStats = {
        'ASCII Art': stats['ASCII Art'] || 0,
    };

    for (const filter in globalFiltersStats) {
        const li = document.createElement('li');
        li.classList.add('stats-item');
        li.innerHTML = `
            <span class="stats-item-label">${filter}</span>
            <span class="stats-item-count">${globalFiltersStats[filter]}</span>
        `;
        globalFiltersStatsList.appendChild(li);
    }
  };

  const loadGlobalFilterSettings = () => {
    chrome.storage.local.get(Object.keys(globalFilters), (result) => {
      for (const key in globalFilters) {
        if (result[key] !== undefined) {
          globalFilters[key].checked = result[key];
        }
      }
    });
  };

  const saveGlobalFilterSetting = (e) => {
    const { id, checked } = e.target;
    const key = Object.keys(globalFilters).find(key => globalFilters[key].id === id);
    if (key) {
      chrome.storage.local.set({ [key]: checked });
    }
  };


  chrome.storage.local.get(['blockedWords', 'stats'], (result) => {
    let words = result.blockedWords || [];
    let stats = result.stats || {};
    renderBlockedWords(words);
    renderStats(stats, words);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.blockedWords || changes.stats) {
        chrome.storage.local.get(['blockedWords', 'stats'], (result) => {
            let words = result.blockedWords || [];
            let stats = result.stats || {};
            renderBlockedWords(words);
            renderStats(stats, words);
        });
    }
  });

  const addWord = () => {
    const newWord = wordInput.value.trim();
    if (newWord) {
      chrome.storage.local.get(['blockedWords'], (result) => {
        const words = result.blockedWords || [];
        if (!words.some(item => item.word === newWord)) {
          const newWords = [...words, { word: newWord, addedAt: new Date().toISOString(), enabled: true }];
          chrome.storage.local.set({ blockedWords: newWords });
          wordInput.value = '';
        }
      });
    }
  };

  addWordBtn.addEventListener('click', addWord);
  wordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
          addWord();
      }
  });

  const switchPage = (page) => {
    if (page === 'stats') {
        blocklistPage.classList.remove('active');
        statsPage.classList.add('active');
        blocklistBtn.classList.remove('active');
        statsBtn.classList.add('active');
    } else {
        statsPage.classList.remove('active');
        blocklistPage.classList.add('active');
        statsBtn.classList.remove('active');
        blocklistBtn.classList.add('active');
    }
  };

  blocklistBtn.addEventListener('click', () => switchPage('blocklist'));
  statsBtn.addEventListener('click', () => switchPage('stats'));

  loadGlobalFilterSettings();
  for (const key in globalFilters) {
    globalFilters[key].addEventListener('change', saveGlobalFilterSetting);
  }
});
