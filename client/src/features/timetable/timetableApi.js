import { api } from '@/lib/api';

export const timetableApi = {
  initialData: () => api.get('/timetable/initial').then((r) => r.data),
  generate: (payload) => api.post('/timetable/generate', payload).then((r) => r.data),
  readiness: (examinationSessionId) => api.get(`/timetable/readiness/${examinationSessionId}`).then((r) => r.data),
  list: (params) => api.get('/timetable', { params }).then((r) => r.data.entries),
  updateEntry: (entryId, payload) => api.patch(`/timetable/entries/${entryId}`, payload).then((r) => r.data),
  deleteEntry: (entryId) => api.delete(`/timetable/entries/${entryId}`).then((r) => r.data),
  deleteTimetable: (examinationSessionId) => api.delete(`/timetable/${examinationSessionId}`).then((r) => r.data),

  generateStream: (payload, onProgress) => {
    const token = localStorage.getItem('token');
    return fetch(`${import.meta.env.VITE_API_URL || '/api'}/timetable/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    }).then(async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'progress' && onProgress) {
                onProgress(data.message);
              } else if (data.type === 'done') {
                finalResult = data.result;
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
      return finalResult;
    });
  },
};
