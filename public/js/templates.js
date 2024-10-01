// public/js/templates.js
$(document).ready(function () {
 // Handle view template button click
$('.view-template-btn').on('click', function () {
  const templateId = $(this).data('id');

  $.ajax({
    url: `/api/templates/${templateId}`,
    method: 'GET',
    success: function (response) {
      if (response.success) {
        const template = response.template;

        // Parse articleStructure if it's a string
        let articleStructure;
        try {
          articleStructure = typeof template.articleStructure === 'string'
            ? JSON.parse(template.articleStructure)
            : template.articleStructure;
        } catch (error) {
          Swal.fire('エラー', '記事の構成が無効な形式です。', 'error');
          return;
        }

        // Generate HTML for Bootstrap 5 Nav Tabs
        const htmlContent = `
          <!-- Nav Tabs -->
          <ul class="nav nav-tabs" id="templateTab" role="tablist">
            <li class="nav-item" role="presentation">
              <button class="nav-link active" id="general-tab" data-bs-toggle="tab" data-bs-target="#general" type="button" role="tab" aria-controls="general" aria-selected="true">基本情報</button>
            </li>
            <li class="nav-item" role="presentation">
              <button class="nav-link" id="sections-tab" data-bs-toggle="tab" data-bs-target="#sections" type="button" role="tab" aria-controls="sections" aria-selected="false">セクション詳細</button>
            </li>
          </ul>

          <!-- Tab Content -->
          <div class="tab-content" id="templateTabContent" style="margin-top: 20px;">
            <!-- General Information Tab -->
            <div class="tab-pane fade show active text-start" id="general" role="tabpanel" aria-labelledby="general-tab">
              <p><strong>説明:</strong> ${template.description}</p>
              <p><strong>システムメッセージ:</strong> <pre>${escapeHtml(template.systemMessage)}</pre></p>
              <p><strong>タイトル生成プロンプト:</strong> <pre>${escapeHtml(template.titleGenerationPrompt)}</pre></p>
              <p><strong>プロンプト生成:</strong> <pre>${escapeHtml(template.generatePrompt)}</pre></p>
              <p><strong>カテゴリー名:</strong> ${template.categoryName}</p>
              <p><strong>タグ:</strong> ${template.tags.join(', ')}</p>
              <p><strong>セクション数:</strong> ${template.sections}</p>
              <p><strong>トーン:</strong> ${template.tone}</p>
              <p><strong>スタイル:</strong> ${template.style}</p>
              <p><strong>コンテンツの長さ:</strong> ${template.contentLength}</p>
              <p><strong>公開設定:</strong> ${template.isPublic ? '公開' : '非公開'}</p>
            </div>

            <!-- Sections Details Tab -->
            <div class="tab-pane fade" id="sections" role="tabpanel" aria-labelledby="sections-tab">
              ${generateSectionsHTML(articleStructure)}
            </div>
          </div>
        `;

        Swal.fire({
          title: template.name,
          html: htmlContent,
          width: '800px',
          showCloseButton: true,
          showConfirmButton: false,
          customClass: {
            popup: 'custom-editor bg-light',
          },
        });

        // Initialize Bootstrap Tabs (necessary if not already initialized)
        const templateTab = new bootstrap.Tab(document.querySelector('#general-tab'));
      } else {
        Swal.fire('エラー', response.message, 'error');
      }
    },
    error: function () {
      Swal.fire('エラー', 'テンプレートの取得に失敗しました。', 'error');
    },
  });
});

/**
 * Generates HTML for the sections details.
 *
 * @param {object} articleStructure - The structure of the article containing sections and headings.
 * @returns {string} - HTML string representing the sections details.
 */
function generateSectionsHTML(articleStructure) {
  if (!articleStructure.headings || !Array.isArray(articleStructure.headings)) {
    return '<p>セクションの詳細がありません。</p>';
  }

  // Create a table to display sections
  let sectionsHTML = `
    <table class="table table-striped">
      <thead>
        <tr>
          <th scope="col">セクション番号</th>
          <th scope="col">見出し</th>
          <th scope="col">コンテンツの長さ</th>
        </tr>
      </thead>
      <tbody>
  `;

  articleStructure.headings.forEach((section, index) => {
    const heading = section.heading || `セクション ${index + 1}`;
    const length = section.contentLength || '未設定';
    sectionsHTML += `
      <tr>
        <th scope="row">${index + 1}</th>
        <td>${escapeHtml(heading)}</td>
        <td>${length}文字</td>
      </tr>
    `;
  });

  sectionsHTML += `
      </tbody>
    </table>
  `;

  return sectionsHTML;
}

/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * @param {string} unsafe - The string to escape.
 * @returns {string} - Escaped string.
 */
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


  // Handle add template button click
  $(document).on('click','#addTemplateBtn', function () {
    showTemplateForm('新しいテンプレートを追加');
  });
  $(document).on('click','.addTemplateBtn', function () {
    showTemplateForm('新しいテンプレートを追加');
  });

  // Handle edit template button click
  $(document).on('click','.edit-template-btn', function () {
    const templateId = $(this).data('id');
    showTemplateForm('テンプレートを編集', templateId);
  });
// Function to display the template form in SweetAlert2
function showTemplateForm(title, templateId = null) {
  let templateData = {};
  let currentStep = 1;
  let totalSteps = 5;
  let formData = {};

  const fetchTemplateData = templateId
    ? $.ajax({
        url: `/api/templates/${templateId}`,
        method: 'GET',
      })
    : $.Deferred().resolve({ success: true, template: {} });

  fetchTemplateData.done(function (response) {
    if (response.success) {
      templateData = response.template;

      // Initialize formData with existing template data
      formData = {
        templateId: templateData._id || '',
        name: templateData.name || '',
        description: templateData.description || '',
        systemMessage: templateData.systemMessage || '',
        titleGenerationPrompt: templateData.titleGenerationPrompt || '',
        generatePrompt: templateData.generatePrompt || '',
        sections: templateData.sections || 3,
        tone: templateData.tone || '',
        style: templateData.style || '',
        contentLength: templateData.contentLength || 1000,
        categoryName: templateData.categoryName || '',
        tags: templateData.tags ? templateData.tags.join(', ') : '',
        isPublic: templateData.isPublic || false,
        articleStructure: templateData.articleStructure
          ? JSON.parse(templateData.articleStructure)
          : { sections: templateData.sections || 3, headings: [] },
      };

      // Start the multi-step form
      renderStep();
    } else {
      Swal.fire('エラー', response.message, 'error');
    }
  });

  function renderStep() {
    const stepContent = getStepContent(currentStep);
    const showPrev = currentStep > 1;
    const showNext = currentStep < totalSteps;
    const showSubmit = currentStep === totalSteps;

    Swal.fire({
      title: `${title} (${currentStep}/${totalSteps})`,
      html: stepContent,
      width: '800px',
      showCancelButton: true,
      showConfirmButton: true,
      confirmButtonText: showSubmit ? '保存' : '次へ',
      cancelButtonText: showPrev ? '前へ' : 'キャンセル',
      showCloseButton: false,
      focusConfirm: false,
      animation: false,
      didOpen: () => {
        if (currentStep === 3) {
          // Initialize sections fields
          updateSections();
        }

        // Initialize event handler for sections input
        if (currentStep === 3) {
          $('#sections').on('input', function () {
            formData.sections = parseInt($(this).val()) || 1;
            formData.articleStructure.sections = formData.sections;
            updateSections();
          });
        }
      },
      preConfirm: () => {
        const stepValid = validateStep(currentStep);
        if (!stepValid) {
          Swal.showValidationMessage('すべての必須フィールドを入力してください。');
          return false;
        }

        // Collect data from current step
        collectStepData(currentStep);

        if (currentStep === totalSteps) {
          // Generate articleStructure JSON from sections
          const sectionsCount = formData.sections;
          const headings = [];
          for (let i = 1; i <= sectionsCount; i++) {
            const heading = $(`#sectionHeading${i}`).val();
            const contentLength = $(`#sectionContentLength${i}`).val();
            headings.push({ heading: heading, contentLength: parseInt(contentLength) || 500 });
          }
          formData.articleStructure.headings = headings;
        }

        return true;
      },
    }).then((result) => {
      if (result.isConfirmed) {
        if (showSubmit) {
          // Submit the form
          submitForm();
        } else {
          // Move to next step
          currentStep++;
          renderStep();
        }
      } else if (currentStep > 1 && result.dismiss === Swal.DismissReason.cancel) {
        // Move to previous step
        currentStep--;
        renderStep();
      }
    });
  }

  function getStepContent(step) {
    switch (step) {
      case 1:
        return `
          <form id="templateFormStep1">
            <div class="mb-3 text-start">
              <label for="name" class="form-label">名前</label>
              <small class="form-text text-muted small d-block">テンプレートの名前を入力してください。</small>
              <input type="text" class="form-control" name="name" id="name" value="${formData.name}" required>
            </div>
            <div class="mb-3 text-start">
              <label for="description" class="form-label">説明</label>
              <small class="form-text text-muted small d-block">テンプレートの説明を入力してください。</small>
              <textarea class="form-control" name="description" id="description" rows="3" required>${formData.description}</textarea>
            </div>
            <div class="form-check form-switch mb-3 text-start">
              <input class="form-check-input" type="checkbox" name="isPublic" id="isPublic" ${formData.isPublic ? 'checked' : ''}>
              <label class="form-check-label" for="isPublic">公開する</label>
              <small class="form-text text-muted small d-block">テンプレートを公開する場合はチェックしてください。</small>
            </div>
          </form>
        `;
      case 2:
        return `
          <form id="templateFormStep2">
            <div class="mb-3 text-start">
              <label for="systemMessage" class="form-label">システムメッセージ</label>
              <small class="form-text text-muted small d-block">記事生成時に使用するシステムメッセージを入力してください。変数使用可能: {botDescription}, {categoryName}, {tone}, {style}, {postLanguage}</small>
              <textarea class="form-control" name="systemMessage" id="systemMessage" rows="4" required>${formData.systemMessage}</textarea>
            </div>
            <div class="mb-3 text-start">
              <label for="titleGenerationPrompt" class="form-label">タイトル生成プロンプト</label>
              <small class="form-text text-muted small d-block">タイトル生成時に使用するプロンプトを入力してください。変数使用可能: {botDescription}, {categoryName}, {tone}, {style}, {postLanguage}</small>
              <textarea class="form-control" name="titleGenerationPrompt" id="titleGenerationPrompt" rows="3" required>${formData.titleGenerationPrompt}</textarea>
            </div>
            <div class="mb-3 text-start">
              <label for="generatePrompt" class="form-label">プロンプト生成</label>
              <small class="form-text text-muted small d-block">記事生成時に使用するプロンプトテンプレートを入力してください。変数使用可能: {message}, {fetchTitle}, {botDescription}, {targetAudience}, {categoryName}, {postLanguage}, {style}, {tone}, {contentLength}, {articleStructure}</small>
              <textarea class="form-control" name="generatePrompt" id="generatePrompt" rows="5" required>${formData.generatePrompt}</textarea>
            </div>
          </form>
        `;
      case 3:
        return `
          <form id="templateFormStep3">
            <div class="mb-3 text-start">
              <label for="sections" class="form-label">セクション数</label>
              <small class="form-text text-muted small d-block">記事のセクション（段落）の数を入力してください。</small>
              <input type="number" class="form-control" name="sections" id="sections" value="${formData.sections}" required min="1" max="5">
            </div>
            <div id="sectionsContainer">
              ${generateSectionsHTML(formData.sections, formData.articleStructure.headings)}
            </div>
          </form>
        `;
      case 4:
        return `
          <form id="templateFormStep4">
            <div class="mb-3 text-start">
              <label for="tone" class="form-label">トーン</label>
              <small class="form-text text-muted small d-block">記事のトーンを指定してください（例: カジュアル、フォーマル、フレンドリー）。</small>
              <input type="text" class="form-control" name="tone" id="tone" value="${formData.tone}" required>
            </div>
            <div class="mb-3 text-start">
              <label for="style" class="form-label">スタイル</label>
              <small class="form-text text-muted small d-block">記事のスタイルを指定してください（例: 解説的、物語的、説得的）。</small>
              <input type="text" class="form-control" name="style" id="style" value="${formData.style}" required>
            </div>
            <div class="mb-3 text-start">
              <label for="contentLength" class="form-label">コンテンツの長さ</label>
              <small class="form-text text-muted small d-block">記事全体の目標文字数を入力してください。</small>
              <input type="number" class="form-control" name="contentLength" id="contentLength" value="${formData.contentLength}" required>
            </div>
          </form>
        `;
      case 5:
        return `
          <form id="templateFormStep5">
            <div class="mb-3 text-start">
              <label for="categoryName" class="form-label">カテゴリー名</label>
              <small class="form-text text-muted small d-block">記事のカテゴリー名を入力してください。</small>
              <input type="text" class="form-control" name="categoryName" id="categoryName" value="${formData.categoryName}" required>
            </div>
            <div class="mb-3 text-start">
              <label for="tags" class="form-label">タグ (カンマ区切り)</label>
              <small class="form-text text-muted small d-block">記事に関連するタグをカンマ区切りで入力してください。</small>
              <input type="text" class="form-control" name="tags" id="tags" value="${formData.tags}">
            </div>
          </form>
        `;
      default:
        return '';
    }
}
  function validateStep(step) {
    let isValid = true;
    switch (step) {
      case 1:
        isValid = $('#name').val().trim() !== '' && $('#description').val().trim() !== '';
        break;
      case 2:
        isValid =
          $('#systemMessage').val().trim() !== '' &&
          $('#titleGenerationPrompt').val().trim() !== '' &&
          $('#generatePrompt').val().trim() !== '';
        break;
      case 3:
        isValid = $('#sections').val() > 0;
        // Additionally, validate each section's heading and content length
        for (let i = 1; i <= formData.sections; i++) {
          const heading = $(`#sectionHeading${i}`).val().trim();
          const contentLength = $(`#sectionContentLength${i}`).val();
          if (heading === '' || contentLength <= 0) {
            isValid = false;
            break;
          }
        }
        break;
      case 4:
        isValid = $('#tone').val().trim() !== '' && $('#style').val().trim() !== '' && $('#contentLength').val() > 0;
        break;
      case 5:
        isValid = $('#categoryName').val().trim() !== '';
        break;
      default:
        isValid = false;
    }
    return isValid;
  }

  function collectStepData(step) {
    switch (step) {
      case 1:
        formData.name = $('#name').val().trim();
        formData.description = $('#description').val().trim();
        formData.isPublic = $('#isPublic').is(':checked');
        break;
      case 2:
        formData.systemMessage = $('#systemMessage').val().trim();
        formData.titleGenerationPrompt = $('#titleGenerationPrompt').val().trim();
        formData.generatePrompt = $('#generatePrompt').val().trim();
        break;
      case 3:
        formData.sections = parseInt($('#sections').val()) || 1;
        // Article Structure will be handled in preConfirm
        break;
      case 4:
        formData.tone = $('#tone').val().trim();
        formData.style = $('#style').val().trim();
        formData.contentLength = parseInt($('#contentLength').val()) || 1000;
        break;
      case 5:
        formData.categoryName = $('#categoryName').val().trim();
        formData.tags = $('#tags').val().trim();
        break;
      default:
        break;
    }
  }

  function generateSectionsHTML(sectionsCount, existingHeadings = []) {
    let html = '';
    for (let i = 1; i <= sectionsCount; i++) {
      const heading = existingHeadings[i - 1]?.heading || '';
      const contentLength = existingHeadings[i - 1]?.contentLength || 500;
      html += `
        <div class="card mb-3">
          <div class="card-body">
            <h5 class="card-title">セクション ${i}</h5>
            <div class="mb-3">
              <label for="sectionHeading${i}" class="form-label">見出し</label>
              <input type="text" class="form-control" name="sectionHeading${i}" id="sectionHeading${i}" value="${heading}" required>
              <small class="form-text text-muted small">セクション ${i} の見出しを入力してください。</small>
            </div>
            <div class="mb-3">
              <label for="sectionContentLength${i}" class="form-label">コンテンツの長さ (文字数)</label>
              <input type="number" class="form-control" name="sectionContentLength${i}" id="sectionContentLength${i}" value="${contentLength}" required min="100">
              <small class="form-text text-muted small">セクション ${i} のコンテンツの目標文字数を入力してください。</small>
            </div>
          </div>
        </div>
      `;
    }
    return html;
  }

  function updateSections() {
    const sectionsCount = formData.sections;
    const sectionsContainer = $('#sectionsContainer');
    sectionsContainer.empty();

    const articleStructure = formData.articleStructure;

    for (let i = 1; i <= sectionsCount; i++) {
      const heading = articleStructure.headings && articleStructure.headings[i - 1]
        ? articleStructure.headings[i - 1].heading
        : '';
      const contentLength = articleStructure.headings && articleStructure.headings[i - 1]
        ? articleStructure.headings[i - 1].contentLength
        : 500;

      const sectionHtml = `
        <div class="card mb-3">
          <div class="card-body">
            <h5 class="card-title">セクション ${i}</h5>
            <div class="mb-3">
              <label for="sectionHeading${i}" class="form-label">見出し</label>
              <input type="text" class="form-control" name="sectionHeading${i}" id="sectionHeading${i}" value="${heading}" required>
              <small class="form-text text-muted small">セクション ${i} の見出しを入力してください。</small>
            </div>
            <div class="mb-3">
              <label for="sectionContentLength${i}" class="form-label">コンテンツの長さ (文字数)</label>
              <input type="number" class="form-control" name="sectionContentLength${i}" id="sectionContentLength${i}" value="${contentLength}" required min="100">
              <small class="form-text text-muted small">セクション ${i} のコンテンツの目標文字数を入力してください。</small>
            </div>
          </div>
        </div>
      `;
      sectionsContainer.append(sectionHtml);
    }
  }

  function submitForm() {
    // Serialize formData and send via AJAX
    const payload = {
      templateId: formData.templateId,
      name: formData.name,
      description: formData.description,
      systemMessage: formData.systemMessage,
      titleGenerationPrompt: formData.titleGenerationPrompt,
      generatePrompt: formData.generatePrompt,
      articleStructure: JSON.stringify(formData.articleStructure),
      isPublic: formData.isPublic,
      sections: formData.sections,
      tone: formData.tone,
      style: formData.style,
      contentLength: formData.contentLength,
      categoryName: formData.categoryName,
      tags: formData.tags,
    };

    $.ajax({
      url: '/templates/save',
      method: 'POST',
      data: payload,
      success: function (response) {
        if (response.success) {
          Swal.fire('成功', response.message, 'success').then(() => {
            location.reload();
          });
        } else {
          Swal.fire('エラー', response.message, 'error');
        }
      },
      error: function () {
        Swal.fire('エラー', 'テンプレートの保存に失敗しました。', 'error');
      },
    });
  }
}

  // Handle delete template button click
  $('.delete-template-btn').on('click', function () {
    const templateId = $(this).data('id');

    Swal.fire({
      title: '本当に削除しますか？',
      text: 'この操作は元に戻せません！',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'はい、削除します',
      cancelButtonText: 'キャンセル',
    }).then((result) => {
      if (result.isConfirmed) {
        $.ajax({
          url: `/templates/delete/${templateId}`,
          method: 'POST',
          success: function (response) {
            Swal.fire('削除されました', 'テンプレートが削除されました。', 'success').then(() => {
              location.reload();
            });
          },
          error: function () {
            Swal.fire('エラー', 'テンプレートの削除に失敗しました。', 'error');
          },
        });
      }
    });
  });
});
