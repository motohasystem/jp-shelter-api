/**
 * Tutorial Widget
 * Webアプリに組み込んで使えるチュートリアルウィジェット
 */
class TutorialWidget {
  constructor(config) {
    this.config = config;
    this.currentPage = 0;
    this.pages = [];
    this.storageKey = config.storageKey || 'tutorial-widget-dismissed';
    this.container = null;
    this.contentContainer = null;
    this.highlightBox = null;
    this.resizeHandler = null;
  }

  /**
   * 初期化してウィジェットを表示
   */
  async init() {
    // 「次回は表示しない」が設定されているかチェック
    if (localStorage.getItem(this.storageKey) === 'true') {
      return;
    }

    // 設定ファイルを読み込み
    await this.loadConfig();

    // ページがない場合は何もしない
    if (this.pages.length === 0) {
      return;
    }

    // モーダルを作成して表示
    this.createModal();
    this.showPage(0);
  }

  /**
   * 設定ファイルを読み込む
   */
  async loadConfig() {
    try {
      const response = await fetch(this.config.configUrl);
      const data = await response.json();
      this.pages = data.pages || [];
    } catch (error) {
      console.error('Failed to load tutorial config:', error);
    }
  }

  /**
   * モーダルダイアログを作成
   */
  createModal() {
    // オーバーレイとモーダルコンテナを作成
    this.container = document.createElement('div');
    this.container.className = 'tutorial-widget-overlay';
    this.container.innerHTML = `
      <div class="tutorial-widget-modal">
        <button class="tutorial-widget-close" aria-label="閉じる">×</button>
        <div class="tutorial-widget-content"></div>
        <div class="tutorial-widget-footer">
          <label class="tutorial-widget-checkbox">
            <input type="checkbox" id="tutorial-widget-no-show">
            <span>次回は表示しない</span>
          </label>
          <div class="tutorial-widget-buttons">
            <button class="tutorial-widget-nav-btn" id="tutorial-widget-next">つぎへ</button>
          </div>
        </div>
      </div>
    `;

    // イベントリスナーを設定
    const closeBtn = this.container.querySelector('.tutorial-widget-close');
    const navBtn = this.container.querySelector('#tutorial-widget-next');
    const checkbox = this.container.querySelector('#tutorial-widget-no-show');

    closeBtn.addEventListener('click', () => this.close());
    navBtn.addEventListener('click', () => this.nextPage());
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem(this.storageKey, 'true');
      } else {
        localStorage.removeItem(this.storageKey);
      }
    });

    // DOMに追加
    document.body.appendChild(this.container);
    this.contentContainer = this.container.querySelector('.tutorial-widget-content');
  }

  /**
   * 指定したページを表示
   */
  async showPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      return;
    }

    this.currentPage = pageIndex;
    const page = this.pages[pageIndex];

    // 既存のハイライトをクリア
    this.clearHighlight();

    // ハイライトモードかどうかをチェック
    if (page.highlightId) {
      // 既存のモーダルを削除して、ツールチップモードに切り替え
      if (this.container && !this.container.classList.contains('tutorial-widget-tooltip')) {
        this.container.remove();
        this.createTooltip();
      } else if (!this.container) {
        this.createTooltip();
      }
      // ハイライトを作成
      this.createHighlight(page.highlightId);
    } else {
      // 通常のモーダルモード
      if (this.container && this.container.classList.contains('tutorial-widget-tooltip')) {
        this.container.remove();
        this.createModal();
      } else if (!this.container) {
        this.createModal();
      }
    }

    // HTMLコンテンツを読み込んで表示
    try {
      const response = await fetch(page.url);
      const html = await response.text();
      this.contentContainer.innerHTML = html;
    } catch (error) {
      console.error('Failed to load page content:', error);
      this.contentContainer.innerHTML = '<p>コンテンツの読み込みに失敗しました。</p>';
    }

    // ナビゲーションボタンのテキストを更新
    const navBtn = this.container.querySelector('#tutorial-widget-next');
    if (pageIndex === this.pages.length - 1) {
      navBtn.textContent = 'おわり';
    } else {
      navBtn.textContent = 'つぎへ';
    }
  }

  /**
   * 次のページに進む（最後のページの場合は閉じる）
   */
  nextPage() {
    if (this.currentPage < this.pages.length - 1) {
      this.showPage(this.currentPage + 1);
    } else {
      this.close();
    }
  }

  /**
   * モーダルを閉じる
   */
  close() {
    this.clearHighlight();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      window.removeEventListener('scroll', this.resizeHandler);
      this.resizeHandler = null;
    }
  }

  /**
   * ツールチップ形式のモーダルを作成（ハイライト用）
   */
  createTooltip() {
    this.container = document.createElement('div');
    this.container.className = 'tutorial-widget-modal tutorial-widget-tooltip';
    this.container.innerHTML = `
      <button class="tutorial-widget-close" aria-label="閉じる">×</button>
      <div class="tutorial-widget-content"></div>
      <div class="tutorial-widget-footer">
        <label class="tutorial-widget-checkbox">
          <input type="checkbox" id="tutorial-widget-no-show">
          <span>次回は表示しない</span>
        </label>
        <div class="tutorial-widget-buttons">
          <button class="tutorial-widget-nav-btn" id="tutorial-widget-next">つぎへ</button>
        </div>
      </div>
    `;

    // イベントリスナーを設定
    const closeBtn = this.container.querySelector('.tutorial-widget-close');
    const navBtn = this.container.querySelector('#tutorial-widget-next');
    const checkbox = this.container.querySelector('#tutorial-widget-no-show');

    closeBtn.addEventListener('click', () => this.close());
    navBtn.addEventListener('click', () => this.nextPage());
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem(this.storageKey, 'true');
      } else {
        localStorage.removeItem(this.storageKey);
      }
    });

    // DOMに追加
    document.body.appendChild(this.container);
    this.contentContainer = this.container.querySelector('.tutorial-widget-content');
  }

  /**
   * ハイライトボックスを作成
   */
  createHighlight(elementId) {
    const targetElement = document.getElementById(elementId);
    if (!targetElement) {
      console.warn(`Element with id "${elementId}" not found`);
      return;
    }

    // ハイライトボックスを作成
    this.highlightBox = document.createElement('div');
    this.highlightBox.className = 'tutorial-widget-highlight-box';
    document.body.appendChild(this.highlightBox);

    // ハイライトボックスの位置を更新
    this.updateHighlightPosition(targetElement);

    // ツールチップの位置を更新
    this.positionTooltip(targetElement);

    // リサイズとスクロールに対応
    this.resizeHandler = () => {
      this.updateHighlightPosition(targetElement);
      this.positionTooltip(targetElement);
    };
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('scroll', this.resizeHandler, true);
  }

  /**
   * ハイライトボックスの位置を更新
   */
  updateHighlightPosition(element) {
    if (!this.highlightBox) return;

    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    this.highlightBox.style.top = `${rect.top + scrollTop}px`;
    this.highlightBox.style.left = `${rect.left + scrollLeft}px`;
    this.highlightBox.style.width = `${rect.width}px`;
    this.highlightBox.style.height = `${rect.height}px`;
  }

  /**
   * ツールチップの位置を計算して配置
   */
  positionTooltip(targetElement) {
    if (!this.container) return;

    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = this.container.getBoundingClientRect();
    const padding = 20; // ハイライト要素との間隔

    // ビューポートのサイズ
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // デフォルトは下に配置
    let top = rect.bottom + padding;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    let arrowClass = 'arrow-top';

    // 下に十分なスペースがない場合は上に配置
    if (top + tooltipRect.height > viewportHeight) {
      top = rect.top - tooltipRect.height - padding;
      arrowClass = 'arrow-bottom';
    }

    // 上にも十分なスペースがない場合は横に配置
    if (top < 0) {
      top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);

      // 右に配置
      if (rect.right + tooltipRect.width + padding < viewportWidth) {
        left = rect.right + padding;
        arrowClass = 'arrow-left';
      } else {
        // 左に配置
        left = rect.left - tooltipRect.width - padding;
        arrowClass = 'arrow-right';
      }
    }

    // 左右がはみ出る場合の調整
    if (left < padding) {
      left = padding;
    } else if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }

    // topがはみ出る場合の調整
    if (top < padding) {
      top = padding;
    } else if (top + tooltipRect.height > viewportHeight - padding) {
      top = viewportHeight - tooltipRect.height - padding;
    }

    // 矢印のクラスを更新
    this.container.className = 'tutorial-widget-modal tutorial-widget-tooltip ' + arrowClass;

    // 位置を設定
    this.container.style.top = `${top}px`;
    this.container.style.left = `${left}px`;
  }

  /**
   * ハイライトをクリア
   */
  clearHighlight() {
    if (this.highlightBox) {
      this.highlightBox.remove();
      this.highlightBox = null;
    }
  }

  /**
   * 表示状態をリセット（デバッグ用）
   */
  static reset(storageKey = 'tutorial-widget-dismissed') {
    localStorage.removeItem(storageKey);
  }
}

// グローバルに公開
window.TutorialWidget = TutorialWidget;
