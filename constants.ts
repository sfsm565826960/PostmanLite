export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export const INITIAL_HEADERS = [
  { id: '1', key: 'Content-Type', value: 'application/json', enabled: true },
  { id: '2', key: 'Accept', value: '*/*', enabled: true },
];

export const INITIAL_REQUEST = {
  id: '',
  method: 'GET' as const,
  url: 'https://jsonplaceholder.typicode.com/todos/1',
  params: [{ id: '1', key: '', value: '', enabled: true }],
  headers: INITIAL_HEADERS,
  bodyType: 'json' as const,
  bodyContent: '{\n  "title": "foo",\n  "body": "bar",\n  "userId": 1\n}',
  file: null,
  bodyFormData: [{ id: '1', key: '', value: '', type: 'text' as const, enabled: true }],
  bodyFormUrlEncoded: [{ id: '1', key: '', value: '', enabled: true }],
};
