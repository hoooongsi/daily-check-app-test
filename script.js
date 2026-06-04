// ==========================================
// script.js — 퇴근확인 PWA 메인 로직
// ==========================================

// ── ★ 여기에 배포 URL을 넣으세요 ─────────────
var GAS_URL = 'https://script.google.com/macros/s/AKfycbzyHfoSCmBZd9UCQcQe9yblGmILSMgUQjcAjjpzc8DHgwNFVWa_86sznRgdo4d7c7-14A/exec';
// ─────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(function () { console.log('Service Worker 등록 성공'); })
    .catch(function (err) { console.log('Service Worker 등록 실패:', err); });
}

var dateInput    = document.getElementById('date');
var timeInput    = document.getElementById('time');
var memoInput    = document.getElementById('memo');
var photoInput   = document.getElementById('photoInput');
var previewBox   = document.getElementById('previewBox');
var previewImg   = document.getElementById('previewImg');
var removePhoto  = document.getElementById('removePhoto');
var submitBtn    = document.getElementById('submitBtn');
var btnText      = document.getElementById('btnText');
var btnSpinner   = document.getElementById('btnSpinner');
var resultMsg    = document.getElementById('resultMsg');
var pendingList  = document.getElementById('pendingList');
var pendingCount = document.getElementById('pendingCount');
var retryBtn     = document.getElementById('retryBtn');

(function setDefaults() {
  var now  = new Date();
  var yyyy = now.getFullYear();
  var mm   = String(now.getMonth() + 1).padStart(2, '0');
  var dd   = String(now.getDate()).padStart(2, '0');
  dateInput.value = yyyy + '-' + mm + '-' + dd;
  var hh  = String(now.getHours()).padStart(2, '0');
  var min = String(now.getMinutes()).padStart(2, '0');
  timeInput.value = hh + ':' + min;
})();

var resizedBase64 = null;

photoInput.addEventListener('change', function () {
  var file = photoInput.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    resizeImage(e.target.result, 1200, function (resized) {
      resizedBase64  = resized;
      previewImg.src = resized;
      previewBox.classList.remove('hidden');
    });
  };
  reader.readAsDataURL(file);
});

function resizeImage(originalDataUrl, maxSize, callback) {
  var img = new Image();
  img.onload = function () {
    var width  = img.width;
    var height = img.height;
    if (width > maxSize || height > maxSize) {
      if (width > height) {
        height = Math.round(height * maxSize / width);
        width  = maxSize;
      } else {
        width  = Math.round(width * maxSize / height);
        height = maxSize;
      }
    }
    var canvas = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    callback(canvas.toDataURL('image/jpeg', 0.85));
  };
  img.src = originalDataUrl;
}

removePhoto.addEventListener('click', function () {
  photoInput.value = '';
  resizedBase64    = null;
  previewImg.src   = '';
  previewBox.classList.add('hidden');
});

submitBtn.addEventListener('click', function () {
  var date   = dateInput.value;
  var time   = timeInput.value;
  var status = statusSelect.value;
  var memo   = memoInput.value.trim();

    if (!date || !time) {
    showResult('날짜, 퇴근시간은 필수 입력입니다.', 'error');
  }

  var payload = {
    date:     date,
    time:     time,
    memo:     memo,
    photo:    resizedBase64 ? resizedBase64.split(',')[1] : null,
    fileName: resizedBase64 ? (date + '_' + time.replace(':', '') + '.jpg') : null
  };

  setLoading(true);

  if (!navigator.onLine) {
    savePending(payload);
    showResult('⚠️ 오프라인 상태입니다. 기록을 임시 저장했습니다.', 'warning');
    setLoading(false);
    renderPending();
    return;
  }

  sendToGAS(payload)
    .then(function (result) {
      if (result.status === 'success') {
        showResult('✅ 저장 완료! Google Sheets에 기록되었습니다.', 'success');
        clearForm();
      } else {
        throw new Error(result.message || '알 수 없는 오류');
      }
    })
    .catch(function (err) {
      savePending(payload);
      showResult('❌ 전송 실패. 기록을 임시 저장했습니다. (' + err.message + ')', 'error');
      renderPending();
    })
    .finally(function () {
      setLoading(false);
    });
});

function sendToGAS(payload) {
  return fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  })
  .then(function (response) { return response.text(); })
  .then(function (text) {
    try { return JSON.parse(text); }
    catch (e) { return { status: 'success' }; }
  });
}

function savePending(payload) {
  var pending = getPending();
  payload.savedAt = new Date().toISOString();
  pending.push(payload);
  localStorage.setItem('pendingRecords', JSON.stringify(pending));
}

function getPending() {
  return JSON.parse(localStorage.getItem('pendingRecords')) || [];
}

function renderPending() {
  var pending = getPending();
  pendingList.innerHTML = '';
  pendingCount.textContent = pending.length;
  if (pending.length === 0) {
    pendingCount.classList.add('zero');
    retryBtn.classList.add('hidden');
    pendingList.innerHTML = '<p style="font-size:13px; color:var(--text-muted); text-align:center;">미전송 기록이 없습니다 ✓</p>';
    return;
  }
  pendingCount.classList.remove('zero');
  retryBtn.classList.remove('hidden');
  pending.forEach(function (record) {
    var div = document.createElement('div');
    div.className = 'pending-item';
    div.innerHTML =
      '<div class="p-date">' + record.date + ' ' + record.time + '</div>' +
      '<div class="p-detail">' + record.status + ' / ' + (record.memo || '메모 없음') + '</div>' +
      '<div class="p-detail" style="font-size:11px; margin-top:4px; color:var(--text-muted);">저장시각: ' + (record.savedAt ? record.savedAt.replace('T', ' ').slice(0, 16) : '-') + '</div>';
    pendingList.appendChild(div);
  });
}

retryBtn.addEventListener('click', function () {
  if (!navigator.onLine) {
    showResult('⚠️ 아직 오프라인 상태입니다.', 'warning');
    return;
  }
  var pending = getPending();
  if (pending.length === 0) return;
  setLoading(true);
  retryBtn.disabled = true;
  var index = 0;
  var successCount = 0;
  var failCount = 0;
  function sendNext() {
    if (index >= pending.length) {
      setLoading(false);
      retryBtn.disabled = false;
      showResult('재전송 완료: 성공 ' + successCount + '건 / 실패 ' + failCount + '건', successCount > 0 ? 'success' : 'error');
      renderPending();
      return;
    }
    var record = pending[index];
    sendToGAS(record)
      .then(function (result) {
        if (result.status === 'success') {
          successCount++;
          var updated = getPending().filter(function (r) { return r.savedAt !== record.savedAt; });
          localStorage.setItem('pendingRecords', JSON.stringify(updated));
        } else { failCount++; }
      })
      .catch(function () { failCount++; })
      .finally(function () { index++; sendNext(); });
  }
  sendNext();
});

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  if (isLoading) {
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');
  } else {
    btnText.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
  }
}

function showResult(message, type) {
  resultMsg.textContent = message;
  resultMsg.className   = 'result-msg ' + type;
  resultMsg.classList.remove('hidden');
  if (type === 'success') {
    setTimeout(function () { resultMsg.classList.add('hidden'); }, 5000);
  }
}

function clearForm() {
  statusSelect.value = '';
  memoInput.value    = '';
  photoInput.value   = '';
  resizedBase64      = null;
  previewImg.src     = '';
  previewBox.classList.add('hidden');
  var now  = new Date();
  var yyyy = now.getFullYear();
  var mm   = String(now.getMonth() + 1).padStart(2, '0');
  var dd   = String(now.getDate()).padStart(2, '0');
  var hh   = String(now.getHours()).padStart(2, '0');
  var min  = String(now.getMinutes()).padStart(2, '0');
  dateInput.value = yyyy + '-' + mm + '-' + dd;
  timeInput.value = hh + ':' + min;
}

renderPending();
