/**
 * Prompt Optimizer - 深津式5要素構造によるツール別最適化プロンプト生成
 * 5要素: ロール・コンテキスト・制約条件・出力フォーマット・プロセス
 */
var PromptOptimizer = (function () {

  // ============================================================
  // タスク種別の自動判定
  // ============================================================

  /**
   * タスク種別ごとのキーワードとデフォルトロール
   */
  var TASK_DEFINITIONS = {
    code: {
      keywords: [
        'コード', 'プログラム', '実装', '関数', 'クラス', 'メソッド',
        'HTML', 'CSS', 'JavaScript', 'Python', 'Java', 'TypeScript',
        'バグ', 'エラー', 'デバッグ', 'API', 'SQL', 'データベース', 'アルゴリズム', 'リファクタ'
      ],
      role: 'シニアソフトウェアエンジニア'
    },
    analysis: {
      keywords: [
        '分析', '調査', '比較', '考察', '評価', '検討', '原因', '要因',
        'データ', 'レポート', '傾向', 'パターン', 'なぜ', '理由', '課題'
      ],
      role: 'データアナリスト'
    },
    writing: {
      keywords: [
        '文章', '書いて', '作成', '記事', 'ブログ', 'メール', '報告書',
        '企画書', 'プレゼン', 'コピー', '説明文', 'マニュアル', '要約', '翻訳'
      ],
      role: 'プロのライター・編集者'
    },
    idea: {
      keywords: [
        'アイデア', 'ブレスト', '提案', '考えて', 'どうすれば', 'どんな方法',
        '改善', '新しい', 'クリエイティブ', '企画', 'プランニング', '発想'
      ],
      role: 'クリエイティブディレクター'
    },
    search: {
      keywords: [
        '調べて', '検索', '最新', 'ニュース', '情報', '教えて', 'どこ',
        'いつ', '誰が', '何が', 'トレンド', '論文', '事例', 'まとめて'
      ],
      role: 'リサーチスペシャリスト'
    }
  };

  /**
   * 入力テキストからタスク種別を自動判定する
   * キーワードマッチ数が最も多い種別を返す（引き分け・未検出は 'general'）
   */
  function detectTaskType(text) {
    var best = 'general';
    var bestScore = 0;
    Object.keys(TASK_DEFINITIONS).forEach(function (type) {
      var score = TASK_DEFINITIONS[type].keywords.filter(function (kw) {
        return text.indexOf(kw) !== -1;
      }).length;
      if (score > bestScore) {
        bestScore = score;
        best = type;
      }
    });
    return best;
  }

  // ============================================================
  // 5要素の組み立てヘルパー
  // ============================================================

  /**
   * ロール：タスク種別 × ツール固有の修飾を適用
   */
  var ROLE_OVERRIDES = {
    claude:     { code: 'シニアソフトウェアエンジニア兼アーキテクト',      analysis: '論理的思考に優れたデータアナリスト' },
    gemini:     { analysis: 'マルチモーダル分析の専門家',                   search: 'リサーチ＆情報統合スペシャリスト' },
    perplexity: { search: '一次情報を重視するリサーチャー',                  analysis: '証拠ベースの分析専門家' },
    copilot:    { writing: 'Microsoftエコシステムに精通したビジネスライター', code: 'Microsoft技術スタックの専門エンジニア' },
    grok:       { idea: '斬新な視点を持つクリエイティブストラテジスト',       search: 'リアルタイム情報に精通したリサーチャー' },
    chatgpt:    {}
  };

  function getRole(taskType, toolId) {
    var override = ROLE_OVERRIDES[toolId] && ROLE_OVERRIDES[toolId][taskType];
    if (override) return override;
    return TASK_DEFINITIONS[taskType] ? TASK_DEFINITIONS[taskType].role : '優秀なアシスタント';
  }

  /**
   * 制約条件：共通 + タスク種別固有 + 入力長に応じた追加
   */
  var TYPE_CONSTRAINTS = {
    code: [
      '言語を指定したコードブロック（```言語名）で記述する',
      'エラーハンドリングを必ず含める',
      '動作するコードのみを提示する（擬似コード不可）'
    ],
    analysis: [
      '主張には根拠を必ず示す',
      '定量的データがある場合は数値を明示する',
      '個人的意見と客観的事実を区別して記述する'
    ],
    writing: [
      'ターゲット読者を意識した文体にする',
      '冗長な表現を避け簡潔にまとめる',
      '専門用語は初出時に平易な言葉で補足する'
    ],
    idea: [
      '実現可能性の高いアイデアを優先する',
      '斬新さと実用性のバランスを取る',
      '各アイデアに根拠・メリットを添える'
    ],
    search: [
      '情報の出典・根拠を明示する',
      '古い情報や不確かな情報には注意書きを添える',
      '確認できない内容は「不確か」と明示する'
    ],
    general: []
  };

  function getConstraints(taskType, toolId, input) {
    var base = [
      '正確で実用的な内容にする',
      '推測で回答する場合はその旨を明示する'
    ];
    var typeSpecific = TYPE_CONSTRAINTS[taskType] || [];
    var extra = [];
    if (input.length > 300) {
      extra.push('長文のため、回答は段階的に整理して提示する');
    }
    if (toolId === 'perplexity') {
      extra.push('回答には必ず信頼できるソース（URL・出典名）を引用する');
      extra.push('情報の鮮度（公開日・更新日）が分かる場合は明示する');
    }
    return base.concat(typeSpecific).concat(extra);
  }

  /**
   * 出力フォーマット：タスク種別ごとに期待する形式を指示
   */
  var TYPE_FORMATS = {
    code: [
      'コードは ```[言語名] ``` のコードブロック形式で記述する',
      'コードの後に **解説:** として各処理の目的を簡潔に説明する'
    ],
    analysis: [
      '**結論:** 冒頭に1〜2文で要約する',
      '**根拠・詳細:** 箇条書きで整理する',
      '**考察・示唆:** まとめと次のアクションを記述する'
    ],
    writing: [
      '完成した文章本体を提示する',
      '必要な場合は「---」で区切り、編集メモや代替案を追記する'
    ],
    idea: [
      '3〜5件のアイデアを番号付きリストで提示する',
      '各アイデアに「タイトル」「概要」「メリット」「実現方法」を含める'
    ],
    search: [
      '**要約:** 冒頭に2〜3文でまとめる',
      '**詳細:** 箇条書きで補足する',
      '**参考情報:** 出典や関連情報を末尾に記載する'
    ],
    general: [
      '明確で読みやすい構成で回答する',
      '必要に応じて箇条書きや見出しを活用する'
    ]
  };

  function getFormat(taskType, toolId) {
    var lines = (TYPE_FORMATS[taskType] || TYPE_FORMATS.general).slice();
    if (toolId === 'perplexity') {
      lines.push('**引用ソース:** 回答に使用した出典（URLまたは出典名）を末尾にリストアップする');
    }
    return lines;
  }

  /**
   * プロセス：タスク種別ごとの思考ステップ
   */
  var TYPE_PROCESSES = {
    code: [
      '要件の整理（何を実現するか確認する）',
      '実装方針の決定（アルゴリズム・設計の選択）',
      'コードの実装',
      '動作の検証・エラーケースの考慮',
      '解説の追加'
    ],
    analysis: [
      '問いの整理・定義',
      '関連情報・データの整理',
      '因果関係・パターンの分析',
      '結論の導出',
      '示唆・次のアクションの提示'
    ],
    writing: [
      '目的・ターゲット・トーンの確認',
      '構成の設計（見出し・流れ）',
      '本文の執筆',
      '読み返し・簡潔さの改善'
    ],
    idea: [
      '課題・目的の明確化',
      '多角的な視点でアイデアを発散',
      '各アイデアの実現可能性・効果を評価',
      '優先度付きの推奨案の提示'
    ],
    search: [
      '質問の意図・背景の整理',
      '信頼性の高い情報の収集・選別',
      '情報の統合・要約',
      '回答の構成と出典の提示'
    ],
    general: [
      '質問の意図を整理する',
      '回答を構築する',
      '補足情報を追加する'
    ]
  };

  function getProcess(taskType) {
    return TYPE_PROCESSES[taskType] || TYPE_PROCESSES.general;
  }

  /**
   * 深津式5要素プロンプトを組み立てる
   */
  function buildFukazuPrompt(role, context, constraints, formatLines, processSteps) {
    var lines = [];

    lines.push('## ロール');
    lines.push('あなたは' + role + 'として回答してください。');
    lines.push('');

    lines.push('## コンテキスト');
    lines.push(context);
    lines.push('');

    lines.push('## 制約条件');
    constraints.forEach(function (c) { lines.push('- ' + c); });
    lines.push('');

    lines.push('## 出力フォーマット');
    formatLines.forEach(function (f) { lines.push('- ' + f); });
    lines.push('');

    lines.push('## プロセス');
    processSteps.forEach(function (step, i) { lines.push((i + 1) + '. ' + step); });

    return lines.join('\n');
  }

  // ============================================================
  // ツール別テンプレート（深津式5要素）
  // ============================================================

  var TEMPLATES = {
    claude: {
      structure: function (input) {
        var taskType = detectTaskType(input);
        return buildFukazuPrompt(
          getRole(taskType, 'claude'),
          input,
          getConstraints(taskType, 'claude', input),
          getFormat(taskType, 'claude'),
          getProcess(taskType)
        );
      }
    },
    gemini: {
      structure: function (input) {
        var taskType = detectTaskType(input);
        // マルチモーダル補足をコンテキストに付加
        var context = input;
        if (/この(画像|写真|図|グラフ|スクリーンショット|スクショ)/.test(input)) {
          context += '\n\n※添付画像の内容を視覚的に分析した上で回答してください。';
        }
        if (/(YouTube|動画)/.test(input)) {
          context += '\n\n※指定した動画・URLの内容を分析対象としてください。';
        }
        return buildFukazuPrompt(
          getRole(taskType, 'gemini'),
          context,
          getConstraints(taskType, 'gemini', input),
          getFormat(taskType, 'gemini'),
          getProcess(taskType)
        );
      }
    },
    perplexity: {
      structure: function (input) {
        var taskType = detectTaskType(input);
        var formatLines = getFormat(taskType, 'perplexity');
        // 比較質問には比較表を追加
        if (/(比較|違い|どちら)/.test(input)) {
          formatLines = formatLines.concat(['異なる選択肢を比較する場合は比較表形式を用いる']);
        }
        return buildFukazuPrompt(
          getRole(taskType, 'perplexity'),
          input,
          getConstraints(taskType, 'perplexity', input),
          formatLines,
          getProcess(taskType)
        );
      }
    },
    copilot: {
      structure: function (input) {
        var taskType = detectTaskType(input);
        // Microsoft製品文脈をコンテキストに付加
        var context = input;
        if (/(Excel|表計算|マクロ|VBA)/.test(input)) {
          context += '\n\n※Microsoft Excel環境での実装を前提とし、具体的な数式・手順をステップバイステップで示してください。';
        }
        if (/(Word|文書|報告書|企画書)/.test(input)) {
          context += '\n\n※Microsoft Word形式での文書作成を前提とし、フォーマットや構成案も含めてください。';
        }
        if (/(PowerPoint|スライド|プレゼン)/.test(input)) {
          context += '\n\n※Microsoft PowerPointでの利用を前提とし、スライド構成を箇条書きで提案してください。';
        }
        return buildFukazuPrompt(
          getRole(taskType, 'copilot'),
          context,
          getConstraints(taskType, 'copilot', input),
          getFormat(taskType, 'copilot'),
          getProcess(taskType)
        );
      }
    },
    grok: {
      structure: function (input) {
        var taskType = detectTaskType(input);
        // X/Twitterトレンド文脈をコンテキストに付加
        var context = input;
        if (/(トレンド|話題|バズ|最新|ニュース)/.test(input)) {
          context += '\n\n※X/Twitterの最新トレンドや投稿も踏まえて回答してください。';
        }
        return buildFukazuPrompt(
          getRole(taskType, 'grok'),
          context,
          getConstraints(taskType, 'grok', input),
          getFormat(taskType, 'grok'),
          getProcess(taskType)
        );
      }
    },
    chatgpt: {
      structure: function (input) {
        var taskType = detectTaskType(input);
        var constraints = getConstraints(taskType, 'chatgpt', input);
        if (input.length > 200) {
          constraints = constraints.concat(['わかりやすく、簡潔に整理して説明する']);
        }
        return buildFukazuPrompt(
          getRole(taskType, 'chatgpt'),
          input,
          constraints,
          getFormat(taskType, 'chatgpt'),
          getProcess(taskType)
        );
      }
    }
  };

  /**
   * コードに関連するコンテキストがあるか判定（TOOL_MODES から参照）
   */
  function hasCodeContext(text) {
    return TASK_DEFINITIONS.code.keywords.some(function (kw) {
      return text.indexOf(kw) !== -1;
    });
  }

  // ============================================================
  // モード推奨ロジック
  // ============================================================

  /**
   * ツール別の利用可能モード（UIに表示される正式名称）
   */
  var TOOL_MODES = {
    claude: {
      modes: ['Opus 4.6', 'Sonnet 4.5', 'Haiku 4.5', '拡張思考'],
      selectMode: function (text) {
        // 複雑な推論・段階的思考 → 拡張思考
        if (/(ステップバイステップ|段階的|論理的に|証明|数学|推論の過程)/.test(text)) {
          return { mode: '拡張思考' };
        }
        // コーディング・長文分析 → Opus 4.6
        if (hasCodeContext(text) || text.length > 500) {
          return { mode: 'Opus 4.6' };
        }
        // 軽量タスク → Sonnet 4.5
        if (text.length < 100) {
          return { mode: 'Sonnet 4.5' };
        }
        return { mode: 'Opus 4.6' };
      }
    },
    gemini: {
      modes: ['Pro', '思考モード', '高速モード'],
      selectMode: function (text) {
        var needsNormalChat = /(続き|会話を続|履歴|さっきの|前回|ファイルを(アップロード|添付)|複数回)/.test(text);
        var chatType = needsNormalChat ? 'normal' : 'temporary';

        // 複雑な分析・推論 → 思考モード
        if (/(分析|推論|考察|批判的|比較検討|深く|詳細に)/.test(text) || text.length > 500) {
          return { mode: '思考モード', chatType: chatType };
        }
        // 短い質問・素早い回答 → 高速モード
        if (text.length < 100 && !/(画像|写真|動画|YouTube)/.test(text)) {
          return { mode: '高速モード', chatType: chatType };
        }
        // デフォルト → Pro
        return { mode: 'Pro', chatType: chatType };
      }
    },
    chatgpt: {
      modes: ['GPT-5.2 Instant', 'GPT-5.2 Thinking'],
      selectMode: function (text) {
        // 複雑な質問 → Thinking
        if (/(分析|推論|ステップバイステップ|詳細に|比較)/.test(text) || text.length > 300) {
          return { mode: 'GPT-5.2 Thinking' };
        }
        return { mode: 'GPT-5.2 Instant' };
      }
    },
    perplexity: {
      modes: ['クイック検索', 'Pro検索'],
      focusModes: ['Web', 'Academic', 'Writing', 'Wolfram|Alpha', 'YouTube', 'Reddit'],
      selectMode: function (text) {
        var result = {};

        // 深い調査 → Pro検索
        if (/(詳しく|徹底的|網羅的|比較検討|深く調べ)/.test(text)) {
          result.mode = 'Pro検索';
        } else {
          result.mode = 'クイック検索';
        }

        // フォーカスモード判定
        if (/(論文|学術|研究|ジャーナル|査読)/.test(text)) {
          result.focus = 'Academic';
        } else if (/(YouTube|動画|ビデオ)/.test(text)) {
          result.focus = 'YouTube';
        } else if (/(Reddit|掲示板|フォーラム)/.test(text)) {
          result.focus = 'Reddit';
        } else if (/(数学|計算|方程式|積分|微分)/.test(text)) {
          result.focus = 'Wolfram|Alpha';
        } else if (/(作文|文章|執筆|ライティング)/.test(text)) {
          result.focus = 'Writing';
        }

        return result;
      }
    },
    copilot: {
      modes: ['標準', 'Think Deeper'],
      selectMode: function (text) {
        if (/(分析|詳しく|比較|複雑|設計)/.test(text) || text.length > 300) {
          return { mode: 'Think Deeper' };
        }
        return { mode: '標準' };
      }
    },
    grok: {
      modes: ['標準', 'Think', 'DeepSearch'],
      selectMode: function (text) {
        // 網羅的な調査 → DeepSearch
        if (/(調べて|検索|最新|ニュース|まとめて|網羅)/.test(text)) {
          return { mode: 'DeepSearch' };
        }
        // 推論・分析 → Think
        if (/(分析|推論|なぜ|理由|考えて|ステップ)/.test(text)) {
          return { mode: 'Think' };
        }
        return { mode: '標準' };
      }
    }
  };

  /**
   * 最適化されたプロンプトを生成
   */
  function generate(toolId, userInput) {
    var template = TEMPLATES[toolId];
    if (!template) {
      return userInput;
    }

    return template.structure(userInput.trim());
  }

  /**
   * 入力内容に基づく推奨ヒントを取得
   * 戻り値: { hints: string[] } - 表示すべきヒント行の配列
   */
  function getRecommendedHints(toolId, userInput) {
    var toolMode = TOOL_MODES[toolId];
    if (!toolMode) return { hints: [] };

    var result = toolMode.selectMode(userInput);
    var hints = [];

    // モード名
    if (result.mode) {
      hints.push('モード: ' + result.mode);
    }

    // Gemini のチャットタイプ
    if (result.chatType === 'normal') {
      hints.push('通常のチャットを使用してください');
    } else if (result.chatType === 'temporary') {
      hints.push('一時的なチャットを使用してください');
    }

    // Perplexity のフォーカスモード
    if (result.focus) {
      hints.push('フォーカス: ' + result.focus);
    }

    return { hints: hints };
  }

  return {
    generate: generate,
    getRecommendedHints: getRecommendedHints
  };
})();
