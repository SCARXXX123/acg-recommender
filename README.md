ACG VN Recommender
中文介绍

ACG VN Recommender 是一个基于用户描述的视觉小说、动画和漫画推荐系统。用户可以输入喜欢的剧情、角色类型或设定，系统会智能分析并返回最匹配的推荐结果。

English Introduction

ACG VN Recommender is a recommendation system for visual novels, anime, and manga based on user descriptions. Users can input their preferred storylines, character types, or settings, and the system will intelligently analyze and return the most matching recommendations.

中文功能特点

支持内容类型：视觉小说（GALGAME）、动画（ANIME）、漫画（MANGA）

搜索模式：

粗略模式：快速返回基于标签匹配的结果

精准模式：通过语义分析提供更精确的推荐

其他功能：

结果分页加载，避免信息过载

内容描述可展开 / 收起

显示评分和相关链接，方便进一步了解

Features (English)

Content Types Supported: Visual Novels (GALGAME), Anime (ANIME), Manga (MANGA)

Search Modes:

Rough Mode: Quickly returns results based on tag matching

Precise Mode: Provides more accurate recommendations through semantic analysis

Other Features:

Result pagination to avoid information overload

Expand/collapse functionality for content descriptions

Displays ratings and related links for further exploration

中文技术架构

前端：HTML、CSS、JavaScript，提供直观的用户界面

后端：Node.js + Express，处理 API 请求和业务逻辑

数据源：

视觉小说：VNDB (https://vndb.org/)

动画 & 漫画：AniList API (https://anilist.co/home)

AI 集成：使用 DeepSeek API 进行标签提取和语义相似度计算

Technical Architecture (English)

Frontend: HTML, CSS, JavaScript, providing an intuitive user interface

Backend: Node.js + Express, handling API requests and business logic

Data Sources:

Visual Novels: VNDB

Anime & Manga: AniList API

AI Integration: Uses DeepSeek API for tag extraction and semantic similarity calculation

中文使用方法

在文本框中输入您喜欢的剧情、角色类型或设定描述

选择内容类型（GALGAME / ANIME / MANGA）

选择搜索模式（粗略模式 / 精准模式）

点击 搜索 按钮

浏览推荐结果，可点击 展开 查看完整描述，或点击 查看 访问原始页面

Usage (English)

Enter your preferred storyline, character type, or setting description in the text box

Select content type (GALGAME / ANIME / MANGA)

Choose search mode (Rough Mode / Precise Mode)

Click the Search button

Browse the recommended results, click Expand to view full description, or click View to visit the original page

中文开发指南
环境准备

克隆仓库

安装依赖：

npm install


创建 .env 文件，并添加 DeepSeek API Key：

DEEPSEEK_API_KEY=your_api_key_here


启动服务：

node index.js


访问：http://localhost:3000

主要文件说明

index.html：前端页面，包含用户界面和交互逻辑

index.js：后端服务，处理搜索请求和数据处理

fetch_vndb.js：从 VNDB 获取原始数据的工具脚本

Development Guide (English)
Environment Setup

Clone the repository

Install dependencies:

npm install


Create a .env file and add your DeepSeek API Key:

DEEPSEEK_API_KEY=your_api_key_here


Start the service:

node index.js


Visit: http://localhost:3000

Main Files Description

index.html: Frontend page with user interface and interaction logic

index.js: Backend service handling search requests and data processing

fetch_vndb.js: Utility script for fetching raw data from VNDB

中文注意事项

精准模式可能需要更长时间，因为会进行更复杂的语义分析

推荐结果质量取决于输入描述的详细程度

部分内容可能包含日语或英语标题 / 描述

Notes (English)

Precise mode may take longer as it performs more complex semantic analysis

Recommendation quality depends on the detail level of input descriptions

Some content may contain Japanese or English titles/descriptions
