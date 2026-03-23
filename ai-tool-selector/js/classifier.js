/**
 * AI Tool Classifier - 入力内容から最適なAIツールを判定するエンジン
 *
 * 各ツールの得意分野:
 *   Claude      → 長文読解・コード・論理的思考・文章作成
 *   Gemini      → 画像・動画・Google連携
 *   ChatGPT     → 汎用・プラグイン活用
 *   Perplexity  → リアルタイム検索・引用付き回答
 *   Grok        → X/トレンド・最新情報
 *   Copilot     → Excel・Word・PowerPoint
 */
var Classifier = (function () {
  // ツール定義
  var TOOLS = {
    claude: {
      id: "claude",
      name: "Claude Pro",
      plan: "課金",
      color: "#D97706",
      keywords: [
        // コード・開発
        "コード", "コーディング", "プログラム", "プログラミング",
        "バグ", "実装", "リファクタ", "リファクタリング", "デバッグ",
        "設計", "アーキテクチャ", "API", "関数", "クラス", "モジュール",
        "ライブラリ", "フレームワーク", "テスト", "ユニットテスト",
        "HTML", "CSS", "JavaScript", "Python", "Java", "TypeScript",
        "React", "Vue", "Node", "SQL", "データベース", "DB",
        "Git", "GitHub", "Docker", "AWS", "Azure",
        "アルゴリズム", "計算量", "O(n)", "ソート",
        "エラー", "スタックトレース", "ログ", "型", "変数",
        "配列", "オブジェクト", "コンパイル", "ビルド", "デプロイ",
        // 長文読解・文章作成
        "長文", "読解", "文章作成", "ライティング", "論述", "論考",
        "エッセイ", "添削", "校正", "構成", "執筆", "原稿",
        // 論理的思考・分析
        "論理的", "思考整理", "考察", "深掘り", "批評", "批判的",
        "要約", "レビュー", "評価", "整理して", "分析",
      ],
      conditions: [
        { type: "length", min: 500, score: 15 },
        { type: "long_writing", score: 12 },
      ],
    },
    gemini: {
      id: "gemini",
      name: "Gemini Pro",
      plan: "課金",
      color: "#4285F4",
      keywords: [
        // 画像・動画
        "画像", "写真", "動画", "YouTube", "図", "グラフ",
        "チャート", "スクリーンショット", "OCR", "ファイル分析",
        // Google連携
        "Gmail", "スプレッドシート", "Google", "ドライブ",
        "Googleドキュメント", "Googleスライド", "マップ",
        "Google Maps", "カレンダー", "Android", "Pixel", "Chrome拡張",
        "PDF",
      ],
      conditions: [
        { type: "url", score: 10 },
        { type: "image_mention", score: 20 },
      ],
    },
    perplexity: {
      id: "perplexity",
      name: "Perplexity",
      plan: "無料",
      color: "#20B8CD",
      keywords: [
        // リアルタイム検索
        "調べて", "検索", "リサーチ", "調査",
        // 引用・ファクト
        "ソース", "出典", "引用", "参考文献", "エビデンス",
        "論文", "統計", "数値", "根拠", "情報源",
        "ファクトチェック", "事実確認", "比較検討",
        // 時事・事実確認
        "いつ", "何年", "現在", "市場", "業界",
      ],
      conditions: [{ type: "question_latest", score: 15 }],
    },
    copilot: {
      id: "copilot",
      name: "Copilot",
      plan: "無料",
      color: "#7F5AF0",
      keywords: [
        // Microsoft Office
        "Excel", "Word", "PowerPoint", "Outlook", "Teams",
        "Windows", "Office", "Microsoft",
        "表計算", "マクロ", "VBA", "OneDrive", "SharePoint", "Bing",
        // ビジネス文書
        "スライド", "プレゼン", "プレゼンテーション",
        "メール作成", "ビジネス文書", "議事録",
        "報告書", "企画書", "提案書", "見積書",
      ],
      conditions: [],
    },
    grok: {
      id: "grok",
      name: "Grok",
      plan: "無料",
      color: "#000000",
      keywords: [
        // X / SNS
        "Twitter", "ツイート", "ポスト", "リポスト",
        "フォロワー", "インプレッション", "イーロン", "Elon", "Musk",
        "SNS", "ミーム", "炎上",
        // トレンド・最新情報
        "トレンド", "バズ", "話題", "ネタ",
        "最新情報", "速報", "リアルタイム", "今起きている",
      ],
      conditions: [
        { type: "sns_context", score: 10 },
        { type: "x_trend", score: 12 },
      ],
    },
    chatgpt: {
      id: "chatgpt",
      name: "ChatGPT",
      plan: "無料",
      color: "#10A37F",
      keywords: [
        // 汎用・一般
        "教えて", "とは", "意味", "おすすめ", "雑談", "相談",
        "簡単に", "わかりやすく",
        // プラグイン・機能活用
        "プラグイン", "DALL-E", "画像生成", "ブラウジング",
        "GPTs", "カスタムGPT",
        // クリエイティブ
        "アイデア", "ブレスト", "物語", "小説", "詩", "歌詞",
        "作文", "翻訳", "英語", "日本語",
        // 生活・雑学
        "料理", "レシピ", "旅行", "健康",
      ],
      conditions: [],
    },
  };

  // 優先順位（同点時）
  var PRIORITY = [
    "claude",
    "gemini",
    "perplexity",
    "copilot",
    "grok",
    "chatgpt",
  ];

  // コード系キーワード（ツール棲み分け調整に使用）
  var CODE_KEYWORDS = [
    "コード", "コーディング", "プログラム", "プログラミング",
    "バグ", "実装", "リファクタ", "デバッグ", "関数", "クラス",
    "HTML", "CSS", "JavaScript", "Python", "Java", "TypeScript",
    "React", "Vue", "Node", "SQL", "Git", "Docker", "API",
    "アルゴリズム", "コンパイル", "ビルド", "デプロイ",
  ];

  // 長文・論理的文章のキーワード（Claude得意領域）
  var WRITING_KEYWORDS = [
    "長文", "読解", "文章作成", "論述", "エッセイ", "添削",
    "校正", "構成", "執筆", "原稿", "論理的", "思考整理",
    "考察", "深掘り", "批評", "批判的", "要約",
  ];

  /**
   * 入力テキストを分類し、各ツールのスコアを返す
   */
  function classify(input) {
    if (!input || !input.trim()) {
      return null;
    }

    var text = input.trim();
    var scores = {};

    // 各ツールのスコアを計算
    PRIORITY.forEach(function (toolId) {
      scores[toolId] = calculateScore(text, TOOLS[toolId]);
    });

    // ツール棲み分け調整
    adjustToolScores(text, scores);

    // スコア順にソート
    var ranked = PRIORITY.slice().sort(function (a, b) {
      if (scores[b] === scores[a]) {
        return PRIORITY.indexOf(a) - PRIORITY.indexOf(b);
      }
      return scores[b] - scores[a];
    });

    // すべてのスコアが低い場合はChatGPTをデフォルトに
    var maxScore = scores[ranked[0]];
    if (maxScore < 5) {
      scores.chatgpt = Math.max(scores.chatgpt, 20);
      ranked = PRIORITY.slice().sort(function (a, b) {
        if (scores[b] === scores[a]) {
          return PRIORITY.indexOf(a) - PRIORITY.indexOf(b);
        }
        return scores[b] - scores[a];
      });
    }

    // 信頼度を計算（0〜100%）
    var totalScore = 0;
    PRIORITY.forEach(function (id) {
      totalScore += scores[id];
    });

    var results = ranked.map(function (toolId) {
      var confidence =
        totalScore > 0 ? Math.round((scores[toolId] / totalScore) * 100) : 0;
      return {
        tool: TOOLS[toolId],
        score: scores[toolId],
        confidence: confidence,
        reason: generateReason(toolId, text),
      };
    });

    return {
      recommended: results[0],
      alternatives: results.slice(1, 3),
      all: results,
    };
  }

  /**
   * ツールごとのスコアを計算
   */
  function calculateScore(text, tool) {
    var score = 0;
    var lowerText = text.toLowerCase();

    // キーワードマッチング
    tool.keywords.forEach(function (keyword) {
      var lowerKeyword = keyword.toLowerCase();
      // 単語の出現回数に応じてスコア加算（最大3回まで）
      var regex = new RegExp(escapeRegex(lowerKeyword), "gi");
      var matches = text.match(regex);
      if (matches) {
        score += Math.min(matches.length, 3) * 5;
      }
    });

    // 追加条件チェック
    (tool.conditions || []).forEach(function (cond) {
      switch (cond.type) {
        case "length":
          if (text.length >= cond.min) score += cond.score;
          break;
        case "url":
          if (/https?:\/\/\S+/.test(text)) score += cond.score;
          break;
        case "image_mention":
          if (
            /この(画像|写真|図|グラフ|スクリーンショット|スクショ)/.test(text)
          ) {
            score += cond.score;
          }
          break;
        case "long_writing":
          if (WRITING_KEYWORDS.some(function (kw) { return text.indexOf(kw) !== -1; })) {
            score += cond.score;
          }
          break;
        case "question_latest":
          if (/最新|今年|2025|2026|現在の|いま/.test(text)) {
            score += cond.score;
          }
          break;
        case "sns_context":
          if (/(ツイッター|twitter|X(で|の|が))/i.test(text)) {
            score += cond.score;
          }
          break;
        case "x_trend":
          if (/(トレンド|バズ|話題|速報|リアルタイム)/.test(text)) {
            score += cond.score;
          }
          break;
      }
    });

    return score;
  }

  /**
   * ツール棲み分け調整
   * 各ツールの得意分野が重なる場合に適切なツールへスコアを加算する
   */
  function adjustToolScores(text, scores) {
    var hasCode = CODE_KEYWORDS.some(function (kw) { return text.indexOf(kw) !== -1; });
    var hasWriting = WRITING_KEYWORDS.some(function (kw) { return text.indexOf(kw) !== -1; });
    var hasImage = /この(画像|写真|図|グラフ|スクリーンショット|スクショ)/.test(text);
    var hasGoogle = /(Google|Gmail|YouTube|スプレッドシート|ドライブ)/i.test(text);
    var hasSNSTrend = /(X|Twitter|トレンド|バズ|ツイート|SNS)/i.test(text);
    var hasFactSearch = /(論文|統計|ファクトチェック|引用|出典|エビデンス)/.test(text);
    var isLongText = text.length >= 300;

    // コード → Claude優先
    if (hasCode) {
      scores.claude += 15;
    }

    // 長文読解・論理的文章作成 → Claude優先
    if (hasWriting || (isLongText && !hasImage && !hasGoogle)) {
      scores.claude += 10;
    }

    // 画像・動画・Google連携 → Gemini優先
    if (hasImage || hasGoogle) {
      scores.gemini += 15;
      // コードが絡まない画像・分析はGeminiへ
      if (!hasCode) scores.claude = Math.max(0, scores.claude - 5);
    }

    // X/SNS・トレンド → Grok優先（事実引用系はPerplexityと分離）
    if (hasSNSTrend && !hasFactSearch) {
      scores.grok += 12;
    }

    // 引用・論文・ファクト → Perplexity優先（SNSトレンドと分離）
    if (hasFactSearch && !hasSNSTrend) {
      scores.perplexity += 12;
    }
  }

  /**
   * 判定理由の生成
   */
  function generateReason(toolId, text) {
    var reasons = {
      claude: "長文読解・コード・論理的思考・文章作成に最適",
      gemini: "画像・動画・Google連携に最適",
      perplexity: "リアルタイム検索・引用付き回答に最適",
      copilot: "Excel・Word・PowerPoint操作に最適",
      grok: "X/トレンド・最新情報の把握に最適",
      chatgpt: "汎用・プラグイン活用に最適",
    };

    // より具体的な理由を追加
    if (toolId === "claude") {
      if (CODE_KEYWORDS.some(function (kw) { return text.indexOf(kw) !== -1; })) {
        return reasons[toolId] + "（コーディング・技術分析）";
      }
      if (text.length > 500) {
        return reasons[toolId] + "（長文の読解・要約）";
      }
      if (WRITING_KEYWORDS.some(function (kw) { return text.indexOf(kw) !== -1; })) {
        return reasons[toolId] + "（論理的な文章作成）";
      }
    }
    if (toolId === "gemini" && /この(画像|写真|図)/.test(text)) {
      return reasons[toolId] + "（画像解析が可能）";
    }
    if (toolId === "perplexity" && /(論文|統計|引用|エビデンス)/.test(text)) {
      return reasons[toolId] + "（信頼できる出典付きで回答）";
    }
    if (toolId === "grok" && /(トレンド|バズ|X|Twitter)/i.test(text)) {
      return reasons[toolId] + "（リアルタイムのSNS情報）";
    }

    return reasons[toolId];
  }

  /**
   * 正規表現のエスケープ
   */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * ツール情報を取得
   */
  function getToolInfo(toolId) {
    return TOOLS[toolId] || null;
  }

  function getAllTools() {
    return TOOLS;
  }

  return {
    classify: classify,
    getToolInfo: getToolInfo,
    getAllTools: getAllTools,
    PRIORITY: PRIORITY,
  };
})();
