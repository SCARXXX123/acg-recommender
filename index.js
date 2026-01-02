import express from "express";
import axios from "axios";
import { fileURLToPath } from 'url';
import path from 'path';
import OpenAI from "openai";
import 'dotenv/config';

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));
// // 允许跨域预检请求
// app.use(cors({
//     origin: "http://127.0.0.1:5500",
//     methods: ["GET", "POST", "OPTIONS"],
//     allowedHeaders: ["Content-Type"]
// }));

// // 处理 OPTIONS 预检请求
// app.options("*", (req, res) => {
//     res.header("Access-Control-Allow-Origin", "http://127.0.0.1:5500");
//     res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
//     res.header("Access-Control-Allow-Headers", "Content-Type");
//     res.sendStatus(204); // 204 更标准，表示 No Content
// });

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
});


const PORT = 3000;
const OLLAMA_API = "http://127.0.0.1:11434/api/generate";
const VNDB_TAG_API = "https://api.vndb.org/kana/tag";
const VNDB_VN_API = "https://api.vndb.org/kana/vn";

/* ===============================
   首页测试
================================ */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});


// Part 1 VNDB QUERY
/* ===============================
   AI 输出解析
================================ */
function parseAITags(raw) {
    try {
        const match = raw.match(/\[[^\]]*\]/s); // 找第一个 JSON 数组
        if (!match) return [];
        return JSON.parse(match[0].replace(/\r?\n/g, "")); // 去掉换行
    } catch {
        return [];
    }
}
/* ===============================
   1️⃣ 文本 → 英文 tag 名（AI）
================================ */
async function getTagsFromText(text) {

    // DEEPSEEK
    if (!text) return [];

    const prompt = `
    You are a visual novel (galgame) tag analyzer.
    Based on the user's description, output the most relevant VNDB tag names in English.
    Rules:
    - Output ONLY a JSON array
    - No explanation
    - Short English tag names
    - Avoid generic tags like "Drama", "Romance" unless absolutely necessary
    - Prefer specific story or character traits
    User description:
    "${text}"
  `;

    try {
        const res = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "You strictly follow the output rules and only return JSON array of VNDB tags." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const raw = res.choices[0].message.content;
        return parseAITags(raw); // 复用已有的解析函数
    } catch (e) {
        console.error("AI 请求失败:", e.message);
        if (e.response) {
            console.error("错误详情:", e.response.data);
        }
        return [];
    }

    // 固定测试用例
    // return ["School Life", "Redemption", "Student"];

    // 本地AI
    // if (!text) return [];

    // const prompt = `
    //     You are a visual novel (galgame) tag analyzer.

    //     Based on the user's description, output the most relevant VNDB tag names in English.

    //     Rules:
    //     - Output ONLY a JSON array
    //     - No explanation
    //     - Short English tag names

    //     User description:
    //     "${text}"
    //     `;

    // try {
    //     const res = await axios.post(OLLAMA_API, {
    //         model: "deepseek-r1:8b",
    //         prompt,
    //         stream: false
    //     });

    //     return parseAITags(res.data.response);
    // } catch (e) {
    //     console.error("AI 请求失败:", e.message);
    //     return [];
    // }
}

/* ===============================
   2️⃣ 英文 tag 名 → VNDB tag id
================================ */
async function getVNDBTagIds(tagNames) {
    const ids = [];
    for (const name of tagNames) {
        try {
            const res = await axios.post(VNDB_TAG_API, {
                filters: [
                    "and",
                    ["search", "=", name]
                ],
                fields: "id,name",
                results: 1, // 取最相关的
                sort: "searchrank"
            }, { headers: { "Content-Type": "application/json" } });

            if (res.data?.results?.length) ids.push(res.data.results[0].id);
        } catch (err) {
            console.error(`Tag "${name}" VNTAG 查询失败:`, err.response?.data || err.message);
        }
    }
    return ids;
}

/* ===============================
   3️⃣ tag id → VNDB VN 查询
================================ */
async function searchVNByTags(
    tagIds,
    {
        maxResults = 200,
        sortBy = "rating",   // rating | votecount
        minRating = 60,      // >= 7.0
        minVotes = 5
    } = {}
) {
    if (!tagIds.length) return [];

    const results = [];
    let page = 1;
    const perPage = 50;

    const tagFilter =
        tagIds.length === 1
            ? ["tag", "=", tagIds[0]]
            : ["or", ...tagIds.map(id => ["tag", "=", id])];

    const filters = [
        "and",
        tagFilter,
        ["rating", ">=", minRating],
        ["votecount", ">=", minVotes]
    ];

    try {
        while (results.length < maxResults) {
            const res = await axios.post(
                VNDB_VN_API,
                {
                    filters,
                    fields: "id,title,alttitle,description,rating,votecount",
                    sort: sortBy,
                    reverse: true,
                    results: perPage,
                    page
                },
                { headers: { "Content-Type": "application/json" } }
            );

            if (!res.data?.results?.length) break;
            results.push(...res.data.results);

            if (res.data.results.length < perPage) break;
            page++;
        }

        // ⭐ 在后端统一整理返回结构
        return results.slice(0, maxResults).map(vn => ({
            id: vn.id,
            title: vn.title,
            alttitle: vn.alttitle,
            description: vn.description,
            rating: vn.rating ? (vn.rating / 10).toFixed(1) : null,
            votecount: vn.votecount,
            url: `https://vndb.org/${vn.id}`
        }));

    } catch (err) {
        console.error("VNDB VN 查询失败:", err.response?.data || err.message);
        return [];
    }
}


// Part 2 ANILIST QUERY
const ANILIST_API = "https://graphql.anilist.co";

// ================================
// 全局缓存官方元数据
// ================================
let OFFICIAL_GENRES = [];
let OFFICIAL_TAGS = [];

async function loadAniListMeta() {
    try {
        // 1) 官方 genre
        const genreRes = await axios.post(ANILIST_API, {
            query: `
        query { GenreCollection }
      `
        });
        OFFICIAL_GENRES = genreRes.data?.data?.GenreCollection || [];

        // 2) 官方 tag
        const tagRes = await axios.post(ANILIST_API, {
            query: `
        query { MediaTagCollection { name } }
      `
        });
        OFFICIAL_TAGS = tagRes.data?.data?.MediaTagCollection.map(t => t.name) || [];

        console.log("Loaded AniList genres:", OFFICIAL_GENRES);
        console.log("Loaded AniList tags:", OFFICIAL_TAGS.length, "tags");
    } catch (e) {
        console.error("加载官方 AniList 元数据失败:", e.message);
    }
}

// 启动时加载一次
loadAniListMeta();

/* ===============================
   工具：清洗 AniList HTML 描述
================================ */
function stripHtml(html) {
    if (!html) return "";
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?[^>]+>/g, "")
        .trim();
}

/* ===============================
   1️⃣ 文本 → AniList tags（AI）
================================ */
async function getAniListTagsFromText(text, mediaType) {
    if (!text) return { tags: [] };

    const prompt = `
You are an ${mediaType === "MANGA" ? "manga" : "anime"} tag analyzer.

From the user description, extract suitable AniList tags only.

Rules:
- Output ONLY valid JSON
- No explanation
- Tags should be common AniList tags (from official ${OFFICIAL_TAGS.join(", ")})
- Keep concise (max 5 tags)

JSON format:
{
  "tags": []
}

User description:
"${text}"
`;

    try {
        const res = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "Only output JSON. No explanation." },
                { role: "user", content: prompt }
            ],
            temperature: 0.4,
            max_tokens: 300
        });

        const output = JSON.parse(res.choices[0].message.content);
        // 过滤官方 tag 并限制最多 5 个
        output.tags = (output.tags || []).filter(t => OFFICIAL_TAGS.includes(t)).slice(0, 5);

        return output;

    } catch (e) {
        console.error("AniList AI 解析失败:", e.message);
        return { tags: [] };
    }
}

/* ===============================
   2️⃣ tags → AniList OR 搜索
================================ */
async function searchAniListByTagsOR({ tags = [] }, mediaType = "ANIME", perPage = 50) {
    const allMediaMap = new Map(); // 用 id 去重

    async function queryOnce(singleTag) {
        const query = `
query ($type: MediaType, $tags: [String]) {
  Page(page: 1, perPage: ${perPage}) {
    media(
      type: $type,
      tag_in: $tags,
      sort: POPULARITY_DESC
    ) {
      id
      title { romaji english native }
      description
      averageScore
      siteUrl
      coverImage { large medium }
    }
  }
}`;
        try {
            const res = await axios.post(
                ANILIST_API,
                { query, variables: { type: mediaType, tags: [singleTag] } },
                { headers: { "Content-Type": "application/json", Accept: "application/json" } }
            );
            const media = res.data?.data?.Page?.media || [];
            media.forEach(item => {
                if (!allMediaMap.has(item.id)) allMediaMap.set(item.id, item);
            });
        } catch (e) {
            console.error("AniList 查询失败:", e.response?.data || e.message);
        }
    }

    // 遍历每个 tag 分别查询（OR）
    for (const tag of tags) {
        await queryOnce(tag);
    }

    // 转换为统一格式
    return Array.from(allMediaMap.values()).map(item => ({
        id: item.id,
        title: item.title.romaji || item.title.english || item.title.native || "Untitled",
        alttitle: item.title.english || "",
        description: stripHtml(item.description),
        rating: item.averageScore ? (item.averageScore / 10).toFixed(1) : null,
        image: item.coverImage?.large || item.coverImage?.medium || null,
        votecount: null,
        url: item.siteUrl
    }));
}

/* ===============================
   3️⃣ 对外统一函数
================================ */
async function searchAniList(text, mediaType) {
    const filters = await getAniListTagsFromText(text, mediaType);
    console.log("===== AniList SEARCH DEBUG =====");
    console.log("User description:", text);
    console.log("Media type:", mediaType);
    console.log("AI tags:", filters.tags);
    return await searchAniListByTagsOR(filters, mediaType);
}


// Filter by Text
function shouldEnableSemanticFilter(text) {
    if (!text) return false;
    return text.trim().length >= 20;
}

async function calcSimilarity(userText, description) {
    if (!description) return 0;
    console.log("🧠 calcSimilarity CALLED");
    console.log("User text len:", userText.length);
    console.log("Desc len:", description.length);
    const prompt = `
        You are a semantic similarity evaluator.

        Compare the following two texts and output a similarity score between 0 and 1.

        Rules:
        - Output ONLY a number between 0 and 1
        - No explanation

        User text:
        "${userText}"

        Item description:
        "${description}"
        `;

    try {
        const res = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "Only output a number between 0 and 1." },
                { role: "user", content: prompt }
            ],
            temperature: 0,
            max_tokens: 20
        });

        const score = parseFloat(res.choices[0].message.content);
        return isNaN(score) ? 0 : score;
    } catch (e) {
        console.error("Similarity calc failed:", e.message);
        return 0;
    }
}

async function semanticFilterItems(items, userText, {
    minScore = 0.35,
    maxResults = 20,
    topN = 50,
    batchSize = 5 // 每次并发多少条
} = {}) {
    console.log("Semantic filter items count before filtering:", items.length);

    // 先过滤空描述
    items = items.filter(item => item.description && item.description.length >= 20);
    console.log("Semantic filter items count after filtering empty descriptions:", items.length);

    // 裁剪 topN
    items = items.slice(0, topN);
    console.log("Semantic filter items count after slice:", items.length);

    const scored = [];

    // 分批处理
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const promises = batch.map(async item => {
            try {
                const score = await calcSimilarity(userText, item.description);
                if (score != null && score >= minScore) {
                    return { ...item, similarity: score };
                }
                return null;
            } catch (e) {
                console.warn("calcSimilarity error for item", item.id, e.message);
                return null;
            }
        });

        const batchResults = await Promise.all(promises);
        scored.push(...batchResults.filter(x => x));
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, maxResults);
}

async function semanticFilterItemsStream({
    items,
    userText,
    res,
    minScore = 0.35,
    batchSize = 5
}) {
    const filtered = items.filter(item => item.description);
    console.log("🔥 semanticFilterItemsStream START");
    console.log("items total:", items.length);
    const total = filtered.length;
    let sentCount = 0;
    console.log("🔥 filtered items:", filtered.length);
    for (let i = 0; i < filtered.length; i += batchSize) {
        const batch = filtered.slice(i, i + batchSize);

        const scored = await Promise.all(batch.map(async item => {
            const score = await calcSimilarity(userText, item.description);
            return score >= minScore ? { ...item, similarity: score } : null;
        }));

        const passed = scored.filter(Boolean);
        sentCount += passed.length;

        res.write(JSON.stringify({
            type: "progress",
            done: sentCount,
            total,
            progress: Math.round((sentCount / total) * 100),
            results: passed
        }) + "\n");
    }

    res.write(JSON.stringify({ type: "end" }) + "\n");
}



/* ===============================
   主接口：POST /search
================================ */
app.post("/search", async (req, res) => {
    const { text, type } = req.body;
    console.log("==== /search called(Rough Mode) ====");
    console.log("Request body:", req.body);
    const response = {
        input: text,
        type,
        status: {},
        results: [],
        debug: {}
    };

    try {
        response.debug.apiKeyLoaded = !!process.env.DEEPSEEK_API_KEY;

        /* ===============================
           GALGAME → VNDB
        ================================ */
        if (type === "GALGAME") {

            const aiTags = await getTagsFromText(text);
            response.aiTags = aiTags;

            const tagIds = await getVNDBTagIds(aiTags);
            response.tagIds = tagIds;

            let vns = await searchVNByTags(tagIds);

            response.results = vns;

            response.status.source = "VNDB";
        }

        /* ===============================
           ANIME → AniList
        ================================ */
        if (type === "ANIME") {
            let items = await searchAniList(text, "ANIME");

            response.results = items;
            response.status.source = "AniList-ANIME";
        }

        /* ===============================
           COMICS → AniList (MANGA)
        ================================ */
        if (type === "MANGA") {
            let items = await searchAniList(text, "MANGA");

            response.results = items;
            response.status.source = "AniList-MANGA";
        }

        res.json(response);

    } catch (err) {
        console.error("接口错误:", err.message);
        res.status(500).json({ error: "服务器错误", details: err.message });
    }
});

/* ===============================
   流式接口：POST /search-stream
================================ */

app.post("/search-stream", async (req, res) => {
    const { text, type } = req.body;

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    try {
        let items = [];

        // GALGAME → VNDB
        if (type === "GALGAME") {
            const aiTags = await getTagsFromText(text);
            const tagIds = await getVNDBTagIds(aiTags);
            items = await searchVNByTags(tagIds);
        }

        // ANIME / MANGA → AniList
        if (type === "ANIME" || type === "MANGA") {
            items = await searchAniList(text, type);
        }

        // 只做精准模式，调用语义过滤流式返回
        await semanticFilterItemsStream({ items, userText: text, res });

    } catch (e) {
        console.error(e);
        res.write(JSON.stringify({ type: "error", message: e.message }) + "\n");
        res.end();
    }
});



// app.post("/search", async (req, res) => {
//     const { text } = req.body;
//     const response = { input: text, status: {}, aiTags: [], tagIds: [], results: [], debug: {} };

//     try {
//         // 打印环境变量状态
//         response.debug.apiKeyLoaded = !!process.env.DEEPSEEK_API_KEY;
//         console.log("DEEPSEEK_API_KEY loaded:", response.debug.apiKeyLoaded);

//         // 1️⃣ 调用 AI 获取标签
//         try {
//             const aiTags = await getTagsFromText(text);
//             console.log("AI tags:", aiTags);
//             response.aiTags = aiTags;
//             response.status.ai = aiTags.length ? "ok" : "empty";
//         } catch (e) {
//             console.error("AI 请求失败:", e.message);
//             response.status.ai = "error: " + e.message;
//         }

//         // 2️⃣ AI 标签 → VNDB tag IDs
//         try {
//             const tagIds = await getVNDBTagIds(response.aiTags);
//             console.log("Matched tag IDs:", tagIds);
//             response.tagIds = tagIds;
//             response.status.tags = tagIds.length ? "ok" : "empty";
//         } catch (e) {
//             console.error("VNDB tag 查询失败:", e.message);
//             response.status.tags = "error: " + e.message;
//         }

//         // 3️⃣ tag IDs → VNDB VN 查询
//         try {
//             const vns = await searchVNByTags(response.tagIds);
//             response.results = vns;
//             response.status.vns = vns.length ? "ok" : "empty";
//         } catch (e) {
//             console.error("VNDB VN 查询失败:", e.message);
//             response.status.vns = "error: " + e.message;
//         }

//         // 返回 debug 信息，方便前端或日志查看
//         res.json(response);

//     } catch (err) {
//         console.error("整体接口错误:", err.message);
//         res.status(500).json({ error: "服务器错误", details: err.message });
//     }
// });


/* ===============================
   测试入口
================================ */
// async function test() {
//     console.log("=== 测试 AI → VNDB 流程 ===");
//     const text = "我喜欢救赎类的故事。女主角最好是学生";

//     const aiTags = await getTagsFromText(text);
//     console.log("AI tags:", aiTags);

//     const tagIds = await getVNDBTagIds(aiTags);
//     console.log("Matched tag IDs:", tagIds);

//     const vns = await searchVNByTags(tagIds);
//     console.log("VNDB 查询结果:", vns);
// }

// // 如果直接运行 index.js，就做一次测试
// if (process.argv[2] !== "no-test") {
//     test();
// }

/* ===============================
   启动服务
================================ */
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
