# YouTube Keyword Analyzer

## 로컬 실행

정적 HTML은 .env를 직접 읽을 수 없으므로, `/api/config`가 요청 시 환경변수를 읽어 브라우저에 넘겨줄 설정 스크립트를 생성합니다.

1. `.env.example`을 `.env`로 복사하고 키와 `AI_PROVIDER`를 설정합니다.
2. 프로젝트 폴더에서 `node server.cjs` 실행 (또는 Vercel CLI가 설치되어 있다면 `vercel dev`)
3. `http://localhost:3000` 접속

API 키와 AI 모델 입력 UI는 없고 `.env` 설정만 사용합니다.

## Vercel 배포

1. `.env`는 `.gitignore`에 포함되어 있어 깃허브에 올라가지 않습니다. 대신 Vercel 프로젝트의 **Settings → Environment Variables**에 아래 값을 등록하세요.
   - `YOUTUBE_API_KEY`
   - `AI_PROVIDER` (`gemini` 또는 `openai`)
   - `GEMINI_API_KEY`
   - `OPENAI_API_KEY`
2. GitHub 저장소를 Vercel에 Import 합니다. 별도의 빌드 설정은 필요 없습니다 (정적 파일 + `api/config.js` 서버리스 함수 구성).
3. 배포가 끝나면 `/api/config`가 요청마다 Vercel에 등록된 환경변수를 읽어 `window.APP_CONFIG`를 내려줍니다.

## 보안 한계

현재 앱은 브라우저에서 YouTube/Gemini/OpenAI API를 직접 호출하므로, `/api/config`가 내려주는 값이 개발자 도구와 네트워크 탭에서 그대로 노출됩니다. 개인용 도구 수준에서는 허용 가능하지만, 다수에게 공개하는 서비스로 운영하려면 API 호출 자체를 서버리스 함수 뒤로 옮기고 키를 브라우저에 절대 전달하지 않아야 합니다. `.env`는 커밋하지 마세요.
