/**
 * App - メインアプリケーションロジック・UI制御
 */
var App = (function () {
  // DOM要素
  var els = {};
  var currentResult = null;
  var currentToolId = null;

  /**
   * 初期化
   */
  function init() {
    els.input = document.getElementById('user-input');
    els.analyzeBtn = document.getElementById('analyze-btn');
    els.resultSection = document.getElementById('result-section');
    els.recommendedCard = document.getElementById('recommended-card');
    els.recommendedName = document.getElementById('recommended-name');
    els.recommendedPlan = document.getElementById('recommended-plan');
    els.recommendedReason = document.getElementById('recommended-reason');
    els.confidenceBar = document.getElementById('confidence-bar');
    els.confidenceValue = document.getElementById('confidence-value');
    els.alternativesContainer = document.getElementById('alternatives');
    els.modelHint = document.getElementById('model-hint');
    els.promptOutput = document.getElementById('prompt-output');
    els.copyOpenBtn = document.getElementById('copy-open-btn');
    els.copyOpenLabel = document.getElementById('copy-open-label');
    els.charCount = document.getElementById('char-count');
    els.notification = document.getElementById('notification');

    els.clearBtn = document.getElementById('clear-btn');

    // イベント登録
    els.analyzeBtn.addEventListener('click', handleAnalyze);
    els.clearBtn.addEventListener('click', handleClear);
    els.copyOpenBtn.addEventListener('click', handleCopyAndOpen);
    els.input.addEventListener('input', updateCharCount);

    // Enter + Ctrl/Cmd で判定
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleAnalyze();
      }
    });

    updateCharCount();
  }

  /**
   * 文字数カウント更新
   */
  function updateCharCount() {
    var len = els.input.value.length;
    els.charCount.textContent = len + '文字';
  }

  /**
   * 入力と結果をクリア
   */
  function handleClear() {
    els.input.value = '';
    currentResult = null;
    currentToolId = null;
    els.resultSection.classList.remove('visible');
    updateCharCount();
    els.input.focus();
  }

  /**
   * 判定実行
   */
  function handleAnalyze() {
    var input = els.input.value;
    if (!input.trim()) {
      showNotification('テキストを入力してください', 'error');
      return;
    }

    var result = Classifier.classify(input);
    if (!result) {
      showNotification('判定できませんでした', 'error');
      return;
    }

    currentResult = result;
    currentToolId = result.recommended.tool.id;
    renderResult(result);
    renderPrompt(currentToolId, input);

    // 結果セクションを表示してスクロール
    els.resultSection.classList.add('visible');
    els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * 判定結果を表示
   */
  function renderResult(result) {
    var rec = result.recommended;
    var tool = rec.tool;

    // 推奨ツールカード
    els.recommendedCard.style.borderColor = tool.color;
    els.recommendedName.textContent = tool.name;
    els.recommendedName.style.color = tool.color;
    els.recommendedPlan.textContent = tool.plan;
    els.recommendedPlan.className = 'plan-badge plan-' + (tool.plan === '課金' ? 'paid' : 'free');
    els.recommendedReason.textContent = rec.reason;

    // 信頼度バー
    els.confidenceBar.style.width = rec.confidence + '%';
    els.confidenceBar.style.backgroundColor = tool.color;
    els.confidenceValue.textContent = rec.confidence + '%';

    // 代替候補
    els.alternativesContainer.innerHTML = '';
    result.alternatives.forEach(function (alt) {
      var card = document.createElement('button');
      card.className = 'alt-card';
      card.style.borderColor = alt.tool.color;
      card.innerHTML =
        '<span class="alt-name" style="color:' + alt.tool.color + '">' + alt.tool.name + '</span>' +
        '<span class="alt-confidence">' + alt.confidence + '%</span>';
      card.addEventListener('click', function () {
        selectAlternative(alt.tool.id);
      });
      els.alternativesContainer.appendChild(card);
    });

    // ボタンラベル更新
    updateCopyButton(tool);
  }

  /**
   * 代替ツールを選択
   */
  function selectAlternative(toolId) {
    currentToolId = toolId;
    var toolInfo = Classifier.getToolInfo(toolId);
    var result = currentResult.all.find(function (r) { return r.tool.id === toolId; });

    els.recommendedCard.style.borderColor = toolInfo.color;
    els.recommendedName.textContent = toolInfo.name;
    els.recommendedName.style.color = toolInfo.color;
    els.recommendedPlan.textContent = toolInfo.plan;
    els.recommendedPlan.className = 'plan-badge plan-' + (toolInfo.plan === '課金' ? 'paid' : 'free');
    els.recommendedReason.textContent = result.reason;

    els.confidenceBar.style.width = result.confidence + '%';
    els.confidenceBar.style.backgroundColor = toolInfo.color;
    els.confidenceValue.textContent = result.confidence + '%';

    renderPrompt(toolId, els.input.value);
    updateCopyButton(toolInfo);
  }

  /**
   * プロンプトを生成・表示
   */
  function renderPrompt(toolId, input) {
    var optimized = PromptOptimizer.generate(toolId, input);
    els.promptOutput.textContent = optimized;

    // 推奨ヒントの表示（複数行対応）
    var result = PromptOptimizer.getRecommendedHints(toolId, input);
    var hints = result.hints;
    if (hints.length > 0) {
      els.modelHint.innerHTML = hints.map(function (h) {
        return '<span class="hint-line">' + escapeHtml(h) + '</span>';
      }).join('');
      els.modelHint.style.display = '';
    } else {
      els.modelHint.style.display = 'none';
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * コピー&オープンボタンのラベル更新
   */
  function updateCopyButton(tool) {
    els.copyOpenLabel.textContent = 'コピーして ' + tool.name + ' を開く';
    els.copyOpenBtn.style.backgroundColor = tool.color;
  }

  /**
   * クリップボードにコピーしてツールを開く
   * iOS対応: 両方の操作をユーザージェスチャー内で実行
   */
  function handleCopyAndOpen() {
    var promptText = els.promptOutput.textContent;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(promptText).then(function () {
        showNotification('プロンプトをコピーしました');
        Launcher.openTool(currentToolId);
      }).catch(function () {
        fallbackCopy(promptText);
        Launcher.openTool(currentToolId);
      });
    } else {
      fallbackCopy(promptText);
      Launcher.openTool(currentToolId);
    }
  }

  /**
   * フォールバック: テキストエリアによるコピー
   */
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showNotification('プロンプトをコピーしました');
    } catch (e) {
      showNotification('コピーに失敗しました。手動でコピーしてください', 'error');
    }
    document.body.removeChild(ta);
  }

  /**
   * 通知表示
   */
  function showNotification(message, type) {
    els.notification.textContent = message;
    els.notification.className = 'notification visible' + (type === 'error' ? ' error' : '');
    setTimeout(function () {
      els.notification.className = 'notification';
    }, 2500);
  }

  // DOM読み込み完了時に初期化
  document.addEventListener('DOMContentLoaded', init);

  return {
    init: init
  };
})();
