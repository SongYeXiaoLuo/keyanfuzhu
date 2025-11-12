/** @type {import('./_venera_.js')} */

class RumanhuaComicSource extends ComicSource {
    name = "如漫画"
    key = "rumanhua"
    version = "1.1.2"
    minAppVersion = "1.6.0"
    url = "https://www.rumanhua.org/"

    #base = "https://www.rumanhua.org"
    #mobileBase = "https://m.rumanhua.org"

    #fixUrl(u) {
        if (!u) return '';
        u = String(u).trim();
        if (!u) return '';
        if (u.startsWith('//')) return 'https:' + u;
        if (/^https?:/i.test(u)) return u;
        if (u.startsWith('/')) return this.#base + u;
        return this.#base + '/' + u;
    }

    explore = [
        {
            title: "如漫画",
            type: "multiPartPage",
            load: async (page) => {
                let res = await Network.get('https://www.rumanhua.org/', {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
                    'Referer': 'https://www.rumanhua.org/',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                })
                if (res.status !== 200) throw `状态码错误: ${res.status}`
                
                const result = [];
                let doc = new HtmlDocument(res.body || '');

                // 统一解析函数（兼容懒加载）
                const parseItem = (item) => {
                    const link = item.querySelector('a') || item;
                    const href = link?.attributes?.href || '';
                    const m = href.match(/\/news\/(\d+)/);
                    if (!m) return null;
                    const img = item.querySelector('img');
                    const src = img?.attributes?.['data-src'] || img?.attributes?.['data-original'] || img?.attributes?.['src'] || '';
                    const title = item.querySelector('.title')?.text?.trim()
                                || item.querySelector('p')?.text?.trim()
                                || img?.attributes?.alt?.trim()
                                || link?.text?.trim()
                                || '';
                    return new Comic({
                        id: m[1],
                        title,
                        cover: this.#fixUrl(src),
                        tags: []
                    });
                };

                // 精品推荐（多选择器兜底）
                let boutique = [];
                try {
                    const boutiqueItems = doc.querySelectorAll('.indexList li, .bookList_1 .item, .bookList_2 .item');
                    for (let i = 0; i < boutiqueItems.length && boutique.length < 8; i++) {
                        const c = parseItem(boutiqueItems[i]);
                        if (c) boutique.push(c);
                    }
                } catch {}
                if (boutique.length > 0) {
                    // 去重
                    const seen = new Set();
                    boutique = boutique.filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)));
                    result.push({ title: '精品推荐', comics: boutique });
                }

                // 排行榜（多选择器兜底）
                let ranking = [];
                try {
                    const rankItems = doc.querySelectorAll('.m_list_1 a, .rankList li, .rankList li a');
                    for (let item of rankItems) {
                        const c = parseItem(item);
                        if (c) ranking.push(c);
                    }
                } catch {}
                if (ranking.length > 0) {
                    const seen = new Set();
                    ranking = ranking.filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)));
                    result.push({ title: '排行榜', comics: ranking });
                }

                // 释放首页文档
                doc.dispose();

                // 若首页为空（可能是反爬页或结构变更），回退到 custom 接口
                if (result.length === 0 || (boutique.length === 0 && ranking.length === 0)) {
                    const loadCustom = async (cat, title) => {
                        const url = `https://www.rumanhua.org/custom/${cat}`;
                        const r = await Network.get(url, {
                            'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
                            'Referer': 'https://www.rumanhua.org/',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                            'Accept-Language': 'zh-CN,zh;q=0.9',
                        });
                        if (r.status !== 200) return null;
                        const d = new HtmlDocument(r.body || '');
                        const list = [];
                        const items = d.querySelectorAll('.rankList li, .m_list_1 a, .bookList_2 .item, .bookList_1 .item');
                        for (let it of items) {
                            const c = parseItem(it);
                            if (c) list.push(c);
                        }
                        d.dispose();
                        if (list.length === 0) return null;
                        // 去重
                        const seen = new Set();
                        const uniq = list.filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)));
                        return { title, comics: uniq };
                    };

                    const sec1 = await loadCustom('recom', '精品推荐');
                    if (sec1) result.push(sec1);
                    const sec2 = await loadCustom('top', '排行榜');
                    if (sec2) result.push(sec2);
                }

                return result;
             }
         }
     ]

    category = {
        title: "分类",
        parts: [
            {
                name: "分类",
                type: "fixed",
                categories: [
                    { label: "最新更新", target: { page: "category", attributes: { category: "update" } } },
                    { label: "精品推荐", target: { page: "category", attributes: { category: "boutique" } } },
                    { label: "编辑推荐", target: { page: "category", attributes: { category: "recom" } } },
                    { label: "排行榜", target: { page: "category", attributes: { category: "top" } } }
                ]
            }
        ],
        enableRankingPage: false
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            let url = `https://www.rumanhua.org/custom/${category}`
            let res = await Network.get(url, {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
            })
            if (res.status !== 200) throw `状态码错误: ${res.status}`
            
            let doc = new HtmlDocument(res.body)
            let comics = []
            let items = doc.querySelectorAll('.rankList li, .m_list_1 a')
            
            for (let item of items) {
                let link = item.querySelector('a') || item
                let href = link.attributes['href']
                let match = href?.match(/\/news\/(\d+)/)
                if (!match) continue
                
                let img = item.querySelector('img')
                let title = item.querySelector('.title')?.text.trim() || item.querySelector('p')?.text.trim() || ''
                let subtitle = item.querySelector('.subtitle')?.text.trim() || ''
                
                comics.push(new Comic({
                    id: match[1],
                    title: title,
                    subTitle: subtitle,
                    cover: this.#fixUrl(img?.attributes['src'] || ''),
                    tags: []
                }))
            }
            
            doc.dispose()
            return { comics: comics, maxPage: 1 }
        }
    }

    search = {
        load: async (keyword, options, page) => {
            let url = `https://www.rumanhua.org/search/${encodeURIComponent(keyword)}`
            let res = await Network.get(url, {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
            })
            if (res.status !== 200) throw `状态码错误: ${res.status}`
            
            let doc = new HtmlDocument(res.body)
            let comics = []
            let items = doc.querySelectorAll('.bookList_2 .item')
            
            for (let item of items) {
                let link = item.querySelector('a')
                let href = link?.attributes['href']
                let match = href?.match(/\/news\/(\d+)/)
                if (!match) continue
                
                let img = item.querySelector('img')
                let title = item.querySelector('.title')?.text.trim() || ''
                let tip = item.querySelector('.tip')?.text.trim() || ''
                
                comics.push(new Comic({
                    id: match[1],
                    title: title,
                    subTitle: tip,
                    cover: this.#fixUrl(img?.attributes['src'] || ''),
                    tags: []
                }))
            }
            
            doc.dispose()
            return { comics: comics, maxPage: 1 }
        }
    }

    comic = {
        loadInfo: async (id) => {
            let res = await Network.get(`https://www.rumanhua.org/news/${id}`, {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
            })
            if (res.status !== 200) throw `状态码错误: ${res.status}`
            
            let doc = new HtmlDocument(res.body)
            let title = doc.querySelector('.detailTop .title')?.text.trim() || ''
            let cover = this.#fixUrl(doc.querySelector('.cover')?.attributes['src'] || '')
            let author = doc.querySelector('.subtitle')?.text.replace('作者：', '').trim() || ''
            let desc = doc.querySelector('.detailContent p')?.text.trim() || ''
            
            // 标签
            let tags = {}
            let tagLinks = doc.querySelectorAll('.detailTop .subtitle a')
            let tagList = []
            for (let tag of tagLinks) {
                tagList.push(tag.text.trim())
            }
            if (tagList.length > 0) tags['类型'] = tagList
            
            // 章节
            let chapters = {}
            let chapterLinks = doc.querySelectorAll('.chapterList a')
            for (let link of chapterLinks) {
                let href = link.attributes['href']
                let match = href?.match(/\/show\/([^.]+)\.html/)
                if (match) chapters[match[1]] = link.text.trim()
            }
            
            doc.dispose()
            return new ComicDetails({
                title: title,
                subtitle: author,
                cover: cover,
                description: desc,
                tags: tags,
                chapters: chapters
            })
        },

        loadEp: async (comicId, epId) => {
            const KEY = '9S8$vJnU2ANeSRoF';

            // 请求移动端阅读页
            const mobUrl = `${this.#mobileBase}/show/${epId}.html`;
            const res = await Network.get(mobUrl, {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Mobile Safari/537.36',
                'Referer': this.#mobileBase + '/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            });
            if (res.status !== 200) throw `移动端页面获取失败: ${res.status}`;
            let html = res.body || '';

            // 1) 多策略提取 params 加密串
            const tryExtractParams = (text) => {
                // 直接形式：var/let/const params = '...'; 或 "..."`
                let m = text.match(/(?:var|let|const)?\s*params\s*=\s*(["'])([\s\S]*?)\1\s*;?/i);
                if (m && m[2]) return m[2].trim();

                // 仅赋值：params='...'
                m = text.match(/params\s*=\s*(["'])([\s\S]*?)\1\s*;?/i);
                if (m && m[2]) return m[2].trim();

                // 被 escape/encode 包裹的情况（document.write(unescape('%3Cscript%3Evar%20params%3D%27xxx%27...')))
                const em = text.match(/unescape\(\s*["']([^"']+)["']\s*\)/i) || text.match(/decodeURIComponent\(\s*["']([^"']+)["']\s*\)/i);
                if (em) {
                    try {
                        const decoded = decodeURIComponent(em[1]);
                        const m2 = decoded.match(/params\s*=\s*(["'])([\s\S]*?)\1/);
                        if (m2 && m2[2]) return m2[2].trim();
                    } catch {}
                }
                return '';
            };

            let encrypted = tryExtractParams(html);

            // 2) 如仍未取到，扫页面中可能直接出现的图片绝对地址兜底
            const collectAbsoluteImages = (text) => {
                const out = [];
                const re = /(https?:\/\/[^\s'"<>]+?\.(?:webp|jpg|jpeg|png|gif))(?:\?[^'"<>\s]*)?/ig;
                let m;
                while ((m = re.exec(text)) !== null) out.push(m[1]);
                // 去重
                const seen = new Set();
                return out.filter(u => (seen.has(u) ? false : (seen.add(u), true)));
            };

            // 尝试解密
            let images = [];
            if (encrypted) {
                // 确保 CryptoJS 可用
                if (typeof CryptoJS === 'undefined') {
                    // 站内路径优先，失败则用 CDN 兜底
                    let js = await Network.get(this.#mobileBase + '/packs/js/crypto-js.min.js', {
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Mobile Safari/537.36',
                        'Referer': this.#mobileBase + '/'
                    });
                    if (js.status !== 200 || !js.body) {
                        js = await Network.get('https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/crypto-js.min.js', {
                            'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Mobile Safari/537.36'
                        });
                        if (js.status !== 200) throw '加载 CryptoJS 失败';
                    }
                    new Function(js.body + ';this.CryptoJS=CryptoJS;').call(globalThis);
                }

                // Base64 -> [IV(16)] + Cipher
                const raw = CryptoJS.enc.Base64.parse(encrypted);
                const iv = CryptoJS.lib.WordArray.create(raw.words.slice(0, 4), 16);
                const ct = CryptoJS.lib.WordArray.create(raw.words.slice(4), raw.sigBytes - 16);
                const keyWA = CryptoJS.enc.Utf8.parse(KEY);
                const decrypted = CryptoJS.AES.decrypt({ ciphertext: ct }, keyWA, { iv });
                const jsonText = decrypted.toString(CryptoJS.enc.Utf8);

                if (jsonText) {
                    try {
                        const data = JSON.parse(jsonText);
                        if (Array.isArray(data.images)) images = data.images.slice();
                    } catch {
                        // 解密失败则继续兜底
                    }
                }
            }

            // 3) 解密仍失败：从 HTML 中直接扫绝对图片地址
            if (!images || images.length === 0) {
                images = collectAbsoluteImages(html);
            }

            if (!images || images.length === 0) {
                throw '未找到章节参数 params，且页面中未匹配到图片地址';
            }

            // 统一为绝对地址（本章已是 https://dmw.546457.xyz/...，保留兼容）
            images = images.map(u => {
                if (/^https?:\/\//i.test(u)) return u;
                if (u.startsWith('//')) return 'https:' + u;
                if (u.startsWith('/')) return this.#mobileBase + u;
                return this.#mobileBase + '/' + u;
            });

            // 去重
            const seen = new Set();
            images = images.filter(u => (seen.has(u) ? false : (seen.add(u), true)));

            return { images };
        },

        onImageLoad: (url) => ({
            headers: {
                'Referer': 'https://m.rumanhua.org/',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Mobile Safari/537.36'
            }
        })
    }
}
