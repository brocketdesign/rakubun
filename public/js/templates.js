// public/js/templates.js
$(document).ready(function() {
    // Handle view template button click
    $('.view-template-btn').on('click', function() {
      const templateId = $(this).data('id');
  
      $.ajax({
        url: `/api/templates/${templateId}`,
        method: 'GET',
        success: function(response) {
          if (response.success) {
            const template = response.template;
  
            Swal.fire({
              title: template.name,
              html: `
                <p><strong>説明:</strong> ${template.description}</p>
                <p><strong>システムメッセージ:</strong><pre>${template.systemMessage}</pre></p>
                <p><strong>プロンプト生成:</strong><pre>${template.generatePrompt}</pre></p>
                <p><strong>カテゴリー名:</strong> ${template.categoryName}</p>
                <p><strong>タグ:</strong> ${template.tags.join(', ')}</p>
              `,
              showCloseButton: true,
              showConfirmButton: false,
              customClass: {
                popup: 'custom-editor bg-light',
              },
            });
          } else {
            Swal.fire('エラー', response.message, 'error');
          }
        },
        error: function() {
          Swal.fire('エラー', 'テンプレートの取得に失敗しました。', 'error');
        },
      });
    });
  
    // Handle add template button click
    $('#addTemplateBtn').on('click', function() {
      showTemplateForm('新しいテンプレートを追加');
    });
  
    // Handle edit template button click
    $('.edit-template-btn').on('click', function() {
      const templateId = $(this).data('id');
      showTemplateForm('テンプレートを編集', templateId);
    });
  
    // Function to display the template form in SweetAlert2
    function showTemplateForm(title, templateId = null) {
      let templateData = {};
  
      const fetchTemplateData = templateId
        ? $.ajax({
            url: `/api/templates/${templateId}`,
            method: 'GET',
          })
        : $.Deferred().resolve({ success: true, template: {} });
  
      fetchTemplateData.done(function(response) {
        if (response.success) {
          templateData = response.template;
  
          const formHtml = `
            <form id="templateForm">
              <input type="hidden" name="templateId" value="${templateData._id || ''}">
              <div class="mb-3">
                <label for="name" class="form-label">名前</label>
                <input type="text" class="form-control" name="name" id="name" value="${templateData.name || ''}" required>
              </div>
              <div class="mb-3">
                <label for="description" class="form-label">説明</label>
                <textarea class="form-control" name="description" id="description" rows="3" required>${templateData.description || ''}</textarea>
              </div>
              <div class="mb-3">
                <label for="systemMessage" class="form-label">システムメッセージ</label>
                <textarea class="form-control" name="systemMessage" id="systemMessage" rows="4" required>${templateData.systemMessage || ''}</textarea>
              </div>
              <div class="mb-3">
                <label for="generatePrompt" class="form-label">プロンプト生成</label>
                <textarea class="form-control" name="generatePrompt" id="generatePrompt" rows="5" required>${templateData.generatePrompt || ''}</textarea>
              </div>
              <div class="mb-3">
                <label for="sections" class="form-label">セクション数</label>
                <input type="number" class="form-control" name="sections" id="sections" value="${templateData.sections || 3}" required>
              </div>
              <div class="mb-3">
                <label for="tone" class="form-label">トーン</label>
                <input type="text" class="form-control" name="tone" id="tone" value="${templateData.tone || ''}" required>
              </div>
              <div class="mb-3">
                <label for="style" class="form-label">スタイル</label>
                <input type="text" class="form-control" name="style" id="style" value="${templateData.style || ''}" required>
              </div>
              <div class="mb-3">
                <label for="contentLength" class="form-label">コンテンツの長さ</label>
                <input type="number" class="form-control" name="contentLength" id="contentLength" value="${templateData.contentLength || 1000}" required>
              </div>
              <div class="mb-3">
                <label for="categoryName" class="form-label">カテゴリー名</label>
                <input type="text" class="form-control" name="categoryName" id="categoryName" value="${templateData.categoryName || ''}" required>
              </div>
              <div class="mb-3">
                <label for="tags" class="form-label">タグ (カンマ区切り)</label>
                <input type="text" class="form-control" name="tags" id="tags" value="${templateData.tags ? templateData.tags.join(', ') : ''}" required>
              </div>
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" name="isPublic" id="isPublic" ${templateData.isPublic ? 'checked' : ''}>
                <label class="form-check-label" for="isPublic">公開する</label>
              </div>
            </form>
          `;
  
          Swal.fire({
            title: title,
            html: formHtml,
            showCancelButton: true,
            confirmButtonText: '保存',
            cancelButtonText: 'キャンセル',
            focusConfirm: false,
            preConfirm: () => {
              const form = $('#templateForm')[0];
              if (!form.checkValidity()) {
                Swal.showValidationMessage('すべての必須フィールドを入力してください。');
                return false;
              }
  
              const formData = $('#templateForm').serialize();
              return formData;
            },
          }).then((result) => {
            if (result.isConfirmed) {
              $.ajax({
                url: '/templates/save',
                method: 'POST',
                data: result.value,
                success: function(response) {
                  if (response.success) {
                    Swal.fire('成功', response.message, 'success').then(() => {
                      location.reload();
                    });
                  } else {
                    Swal.fire('エラー', response.message, 'error');
                  }
                },
                error: function() {
                  Swal.fire('エラー', 'テンプレートの保存に失敗しました。', 'error');
                },
              });
            }
          });
        } else {
          Swal.fire('エラー', response.message, 'error');
        }
      });
    }
  
    // Handle delete template button click
    $('.delete-template-btn').on('click', function() {
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
            success: function(response) {
              Swal.fire('削除されました', 'テンプレートが削除されました。', 'success').then(() => {
                location.reload();
              });
            },
            error: function() {
              Swal.fire('エラー', 'テンプレートの削除に失敗しました。', 'error');
            },
          });
        }
      });
    });
  });
  