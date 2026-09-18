document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const aiProviderSelect = document.getElementById('ai-provider-select');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const searchStatus = document.getElementById('search-status');
    const resultsTbody = document.getElementById('results-tbody');
    const downloadCsvBtn = document.getElementById('download-csv-btn');

    // Dashboard Elements
    const dashboardContainer = document.getElementById('dashboard-container');
    const estimatedVolume = document.getElementById('estimated-volume');
    const competitionIntensity = document.getElementById('competition-intensity');
    const recommendedTags = document.getElementById('recommended-tags');

    // AI Elements
    const aiAnalysisContainer = document.getElementById('ai-analysis-container');
    const aiBadge = document.getElementById('ai-badge');
    const aiLoader = document.querySelector('.ai-loader');
    const aiText = document.getElementById('ai-text');
    const runAiBtn = document.getElementById('run-ai-btn');

    let currentResults = [];
    let lastQuery = '';

    // API keys and AI provider are supplied by /api/config, generated from environment variables.
    const APP_CONFIG = window.APP_CONFIG || {};
    if (aiProviderSelect) aiProviderSelect.value = APP_CONFIG.aiProvider || 'gemini';

    function getSelectedProvider() {
        return aiProviderSelect ? aiProviderSelect.value : (APP_CONFIG.aiProvider || 'gemini');
    }

    function getKeyForProvider(provider) {
        return provider === 'openai' ? (APP_CONFIG.openaiApiKey || '') : (APP_CONFIG.geminiApiKey || '');
    }

    if (runAiBtn) {
        runAiBtn.addEventListener('click', () => {
            if (currentResults.length === 0) return;
            const provider = getSelectedProvider();
            const aiKey = getKeyForProvider(provider);
            if (aiKey) {
                runAIAnalysis(lastQuery, aiKey, provider);
            } else {
                aiBadge.textContent = provider === 'openai' ? 'OpenAI' : 'Gemini';
                aiBadge.className = provider === 'openai' ? 'ai-badge openai' : 'ai-badge';
                aiText.innerHTML = `<span class="optional">${provider === 'openai' ? 'OpenAI' : 'Gemini'} API 키를 설정하면 AI 전략 분석을 볼 수 있습니다.</span>`;
                aiLoader.style.display = 'none';
            }
        });
    }

    // Helper to format numbers
    const formatNumber = (num) => {
        if (num === null || num === undefined) return '0';
        return parseInt(num, 10).toLocaleString('ko-KR');
    };

searchBtn.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        const apiKey=APP_CONFIG.youtubeApiKey||'';

        if (!apiKey) {
            alert('YouTube API 키를 먼저 설정해주세요.');
            return;
        }

        if (!query) {
            alert('검색어를 입력해주세요.');
            return;
        }

        searchBtn.disabled = true;
        searchStatus.textContent = '검색 중... (API 호출 중)';
        resultsTbody.innerHTML = '<tr><td colspan="8" class="empty-state">검색 중입니다...</td></tr>';
        downloadCsvBtn.disabled = true;
        
        dashboardContainer.style.display = 'none';
        aiAnalysisContainer.style.display = 'none';

        try {
            // 1. Search API (Get video IDs)
            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(query)}&key=${apiKey}`;
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();

            if (searchData.error) {
                throw new Error(searchData.error.message);
            }

            if (!searchData.items || searchData.items.length === 0) {
                resultsTbody.innerHTML = '<tr><td colspan="8" class="empty-state">검색 결과가 없습니다.</td></tr>';
                searchStatus.textContent = '';
                searchBtn.disabled = false;
                return;
            }

            const videoIds = searchData.items.map(item => item.id.videoId).join(',');

            // 2. Videos API (Get statistics & tags)
            const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
            const videosRes = await fetch(videosUrl);
            const videosData = await videosRes.json();

            if (videosData.error) {
                throw new Error(videosData.error.message);
            }

            // 3. Collect Channel IDs to get subscriber count
            // Need to split into chunks of max 50 for channels API if we have many, but we only fetched max 50 videos
            const channelIdsSet = new Set(videosData.items.map(item => item.snippet.channelId));
            const channelIds = Array.from(channelIdsSet).join(',');

            // 4. Channels API (Get subscriber count)
            const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds}&key=${apiKey}`;
            const channelsRes = await fetch(channelsUrl);
            const channelsData = await channelsRes.json();

            if (channelsData.error) {
                throw new Error(channelsData.error.message);
            }

            // Create a channel map for easy lookup
            const channelMap = {};
            if (channelsData.items) {
                channelsData.items.forEach(channel => {
                    channelMap[channel.id] = channel.statistics.subscriberCount || '0';
                });
            }

            // 5. Combine Data
            currentResults = videosData.items.map(video => {
                const snippet = video.snippet;
                const stats = video.statistics;
                return {
                    videoId: video.id,
                    thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
                    title: snippet.title,
                    channelTitle: snippet.channelTitle,
                    description: snippet.description,
                    tags: snippet.tags ? snippet.tags.join(', ') : '없음',
                    viewCount: parseInt(stats.viewCount || '0', 10),
                    likeCount: parseInt(stats.likeCount || '0', 10),
                    subscriberCount: parseInt(channelMap[snippet.channelId] || '0', 10)
                };
            });

            // 6. Sort by View Count (Descending)
            currentResults.sort((a, b) => b.viewCount - a.viewCount);

            // 7. Render
            renderTable();
            searchStatus.textContent = `${currentResults.length}개의 결과를 분석했습니다.`;
            downloadCsvBtn.disabled = false;

            // 8. Analyze Dashboard
            analyzeKeywordData(query);
            lastQuery = query;

            // 9. AI Analysis panel (manual trigger via dropdown + button)
            const provider = getSelectedProvider();
            aiAnalysisContainer.style.display = 'block';
            aiBadge.textContent = provider === 'openai' ? 'OpenAI' : 'Gemini';
            aiBadge.className = provider === 'openai' ? 'ai-badge openai' : 'ai-badge';
            aiLoader.style.display = 'none';
            aiText.innerHTML = '<span class="optional">AI 모델을 선택하고 "AI 분석 실행" 버튼을 눌러주세요.</span>';

        } catch (error) {
            console.error(error);
            resultsTbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="color: var(--error-color);">오류가 발생했습니다: ${error.message}</td></tr>`;
            searchStatus.textContent = '검색 실패';
        } finally {
            searchBtn.disabled = false;
        }
    });

    // Enter key support for search
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });

    function analyzeKeywordData(query) {
        if (currentResults.length === 0) return;

        dashboardContainer.style.display = 'grid';

        let totalViews = 0;
        let totalSubs = 0;
        let validSubCount = 0;
        const tagCounts = {};

        currentResults.forEach(item => {
            totalViews += item.viewCount;
            if (item.subscriberCount > 0) {
                totalSubs += item.subscriberCount;
                validSubCount++;
            }

            // Tag frequency
            if (item.tags !== '없음') {
                const tagsArr = item.tags.split(',').map(t => t.trim().toLowerCase());
                tagsArr.forEach(t => {
                    if (!t) return;
                    tagCounts[t] = (tagCounts[t] || 0) + 1;
                });
            }
        });

        const avgViews = totalViews / currentResults.length;
        const avgSubs = validSubCount > 0 ? totalSubs / validSubCount : 0;

        // 1. Estimated Volume
        let volumeLevel = '낮음';
        if (avgViews > 100000) volumeLevel = '매우 높음';
        else if (avgViews > 30000) volumeLevel = '높음';
        else if (avgViews > 5000) volumeLevel = '보통';
        
        estimatedVolume.textContent = `${volumeLevel} (평균: ${formatNumber(avgViews)}회)`;

        // 2. Competition Intensity
        let competition = '보통';
        if (avgSubs === 0) {
            competition = '알 수 없음';
        } else {
            const ratio = avgViews / avgSubs;
            if (ratio > 1) competition = '낮음 (기회)'; 
            else if (ratio > 0.3) competition = '보통';
            else competition = '치열함'; 
        }
        competitionIntensity.textContent = competition;

        // 3. Recommended Tags
        const sortedTags = Object.entries(tagCounts)
            .filter(([tag, _]) => tag !== query.toLowerCase() && tag.length > 1)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(t => t[0]);

        if (sortedTags.length > 0) {
            recommendedTags.innerHTML = sortedTags.map(tag => `<span class="tag-badge">#${tag}</span>`).join('');
        } else {
            recommendedTags.textContent = '추출된 태그 없음';
        }
    }

    async function runAIAnalysis(query, apiKey, provider) {
        aiAnalysisContainer.style.display = 'block';
        aiLoader.style.display = 'block';
        aiText.textContent = '';
        
        aiBadge.textContent = provider === 'openai' ? 'OpenAI' : 'Gemini';
        aiBadge.className = provider === 'openai' ? 'ai-badge openai' : 'ai-badge';

        try {
            let totalViews = 0;
            currentResults.forEach(item => totalViews += item.viewCount);
            const avgViews = totalViews / currentResults.length;
            const topVideo = currentResults[0];

            const prompt = `유튜브 검색어 '${query}'에 대한 상위 노출 영상 데이터입니다:
- 평균 조회수: ${formatNumber(avgViews)}회
- 1위 영상 제목: ${topVideo ? topVideo.title : '없음'} (조회수: ${topVideo ? formatNumber(topVideo.viewCount) : 0}회)

이 데이터를 바탕으로, 해당 키워드로 유튜브 영상을 기획할 때의 추천 전략, 콘텐츠 방향성, 주의할 점 등을 10줄 이내로 핵심만 분석해주세요. 응답은 마크다운 문법 없이 평문으로 깔끔하게 작성해주세요.`;

            let aiResponse = '';

            if (provider === 'openai') {
                const url = 'https://api.openai.com/v1/chat/completions';
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: 500
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                aiResponse = data.choices[0].message.content;
            } else {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })

                });
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                if (data.candidates && data.candidates.length > 0) {
                    aiResponse = data.candidates[0].content.parts[0].text;
                } else {
                    aiResponse = 'AI 응답을 가져올 수 없습니다.';
                }
            }

            aiText.textContent = aiResponse.trim();

        } catch (error) {
            console.error('AI API Error:', error);
            aiText.innerHTML = `<span class="required">AI 분석 오류: ${error.message}</span>`;
        } finally {
            aiLoader.style.display = 'none';
        }
    }

    function renderTable() {
        resultsTbody.innerHTML = '';
        currentResults.forEach(item => {
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td class="thumbnail-cell">
                    <a href="https://www.youtube.com/watch?v=${item.videoId}" target="_blank">
                        <img src="${item.thumbnail}" alt="thumbnail">
                    </a>
                </td>
                <td class="title-cell" title="${escapeHtml(item.title)}">
                    <a href="https://www.youtube.com/watch?v=${item.videoId}" target="_blank">
                        ${escapeHtml(item.title)}
                    </a>
                </td>
                <td class="channel-cell" title="${escapeHtml(item.channelTitle)}">${escapeHtml(item.channelTitle)}</td>
                <td class="desc-cell" title="${escapeHtml(item.description)}"><div class="clamp-text">${escapeHtml(item.description)}</div></td>
                <td class="tags-cell" title="${escapeHtml(item.tags)}"><div class="clamp-text">${escapeHtml(item.tags)}</div></td>
                <td class="number-col">${formatNumber(item.viewCount)}</td>
                <td class="number-col">${formatNumber(item.likeCount)}</td>
                <td class="number-col">${formatNumber(item.subscriberCount)}</td>
            `;
            resultsTbody.appendChild(tr);
        });
    }

    // CSV Download Function
    downloadCsvBtn.addEventListener('click', () => {
        if (currentResults.length === 0) return;

        // Headers
        let csvContent = '\uFEFF'; // BOM for Excel encoding to support Korean
        csvContent += '영상링크,제목,채널명,설명,태그,조회수,좋아요수,구독자수\n';

        currentResults.forEach(item => {
            // Escape quotes and wrap fields with commas in quotes
            const row = [
                escapeCsv(`https://www.youtube.com/watch?v=${item.videoId}`),
                escapeCsv(item.title),
                escapeCsv(item.channelTitle),
                escapeCsv(item.description),
                escapeCsv(item.tags),
                item.viewCount,
                item.likeCount,
                item.subscriberCount
            ].join(',');
            csvContent += row + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'youtube_search_results.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    function escapeCsv(str) {
        let result = (str || '').toString();
        result = result.replace(/"/g, '""'); // Escape double quotes
        return `"${result}"`; // Always wrap in quotes to handle commas, newlines, etc.
    }
});
