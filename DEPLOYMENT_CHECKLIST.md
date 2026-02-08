# 백엔드 구현 체크리스트 및 배포 가이드

## 📋 전체 개요

기존 AWS 인프라를 기반으로 새로운 기능을 추가하기 위한 백엔드 구현이 완료되었습니다.

**생성된 파일**:
1. ✅ `migration_20260208.sql` - 데이터베이스 마이그레이션 스크립트
2. ✅ `index_updated.mjs` - 업데이트된 Lambda 함수
3. ✅ `lockmoment_api_v2.1.md` - API 문서 v2.1
4. ✅ `BACKEND_IMPLEMENTATION_GUIDE.md` - 상세 구현 가이드

---

## 🚀 배포 단계별 가이드

### Phase 1: 데이터베이스 마이그레이션 (30분)

#### 1.1 백업 생성
```bash
# RDS 스냅샷 생성 (AWS Console 또는 CLI)
aws rds create-db-snapshot \
  --db-instance-identifier lockmoment-db \
  --db-snapshot-identifier lockmoment-backup-20260208
```

#### 1.2 마이그레이션 실행
```bash
# 로컬에서 RDS 접속
psql -h your-rds-endpoint.amazonaws.com \
     -U postgres \
     -d lockmoment \
     -f backup/schema/migration_20260208.sql

# 또는 pgAdmin 사용
# 1. RDS 엔드포인트 연결
# 2. migration_20260208.sql 파일 열기
# 3. 실행 (F5)
```

#### 1.3 마이그레이션 검증
```sql
-- 새 컬럼 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'devices' 
  AND column_name LIKE '%permission%';

-- 새 테이블 확인
SELECT COUNT(*) FROM child_schedules;

-- 인덱스 확인
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('devices', 'child_schedules');
```

**예상 결과**:
```
✅ devices 테이블에 4개 권한 컬럼 추가
✅ child_schedules 테이블 생성
✅ 6개 인덱스 생성
✅ 트리거 1개 생성
```

---

### Phase 2: Lambda 함수 업데이트 (20분)

#### 2.1 Lambda 패키지 준비
```bash
cd backup/lambda

# 기존 함수 백업
cp index.mjs index_backup_20260208.mjs

# 새 함수로 교체
cp index_updated.mjs index.mjs

# 의존성 확인 (package.json이 있다면)
npm install

# ZIP 파일 생성
zip -r function.zip index.mjs node_modules/
```

#### 2.2 Lambda 함수 업데이트
```bash
# AWS CLI로 업데이트
aws lambda update-function-code \
  --function-name LockMomentAPI \
  --zip-file fileb://function.zip \
  --region ap-northeast-2

# 또는 AWS Console 사용:
# 1. Lambda 콘솔 접속
# 2. LockMomentAPI 함수 선택
# 3. "Upload from" > ".zip file" 선택
# 4. function.zip 업로드
```

#### 2.3 환경 변수 확인
```bash
# Lambda 환경 변수 확인
aws lambda get-function-configuration \
  --function-name LockMomentAPI \
  --query 'Environment.Variables'

# 필요한 환경 변수:
# - DB_HOST
# - DB_USER
# - DB_PASSWORD
# - DB_NAME
# - DB_PORT
# - QR_SECRET_KEY
```

#### 2.4 Lambda 테스트
```bash
# 테스트 이벤트 생성 (test-event.json)
cat > test-event.json << 'EOF'
{
  "httpMethod": "GET",
  "rawPath": "/parent-child/children",
  "requestContext": {
    "authorizer": {
      "userId": "test-user-uuid"
    }
  },
  "body": "{}"
}
EOF

# Lambda 함수 테스트
aws lambda invoke \
  --function-name LockMomentAPI \
  --payload file://test-event.json \
  --region ap-northeast-2 \
  response.json

# 결과 확인
cat response.json
```

---

### Phase 3: API Gateway 라우트 추가 (15분)

#### 3.1 새 라우트 추가

**AWS Console 방법**:
1. API Gateway 콘솔 접속
2. LockMoment API 선택
3. "Routes" 탭 선택
4. "Create" 버튼 클릭
5. 다음 라우트 추가:

```
GET  /parent-child/children
GET  /parent-child/{childId}/schedules
POST /parent-child/{childId}/schedules
```

6. 각 라우트에 LockMomentAPI Lambda 통합 설정
7. "Deploy" 버튼 클릭

**AWS CLI 방법**:
```bash
# API ID 확인
API_ID=$(aws apigatewayv2 get-apis \
  --query 'Items[?Name==`LockMomentAPI`].ApiId' \
  --output text)

# Integration ID 확인
INTEGRATION_ID=$(aws apigatewayv2 get-integrations \
  --api-id $API_ID \
  --query 'Items[0].IntegrationId' \
  --output text)

# 라우트 생성
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "GET /parent-child/children" \
  --target "integrations/$INTEGRATION_ID"

aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "GET /parent-child/{childId}/schedules" \
  --target "integrations/$INTEGRATION_ID"

aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "POST /parent-child/{childId}/schedules" \
  --target "integrations/$INTEGRATION_ID"
```

#### 3.2 CORS 설정 확인
```bash
# CORS 설정 확인
aws apigatewayv2 get-cors \
  --api-id $API_ID

# 필요시 CORS 업데이트
aws apigatewayv2 update-cors \
  --api-id $API_ID \
  --cors-configuration AllowOrigins='*',AllowMethods='GET,POST,PATCH',AllowHeaders='*'
```

---

### Phase 4: 테스트 (30분)

#### 4.1 권한 업데이트 테스트
```bash
# 디바이스 권한 업데이트
curl -X PATCH \
  "https://18gffqu5rb.execute-api.ap-northeast-2.amazonaws.com/devices/test-device-uuid/permissions" \
  -H "Content-Type: application/json" \
  -d '{
    "accessibility": true,
    "screenTime": true,
    "notification": true
  }'

# 예상 응답:
# {
#   "success": true,
#   "message": "Permissions updated successfully",
#   "device": { ... }
# }
```

#### 4.2 자녀 목록 조회 테스트
```bash
# 자녀 목록 조회
curl -X GET \
  "https://18gffqu5rb.execute-api.ap-northeast-2.amazonaws.com/parent-child/children" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 예상 응답:
# {
#   "success": true,
#   "data": [
#     {
#       "id": "child-uuid",
#       "childName": "김철수",
#       "hasPermission": true,
#       ...
#     }
#   ]
# }
```

#### 4.3 스케줄 저장 테스트
```bash
# 스케줄 생성
curl -X POST \
  "https://18gffqu5rb.execute-api.ap-northeast-2.amazonaws.com/parent-child/CHILD_UUID/schedules" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "저녁 공부 시간",
    "startTime": "18:00",
    "endTime": "20:00",
    "days": ["월", "화", "수", "목", "금"],
    "apps": ["youtube", "instagram"],
    "isActive": true
  }'

# 예상 응답:
# {
#   "success": true,
#   "message": "Schedule created successfully",
#   "data": { ... }
# }
```

#### 4.4 QR 스캔 권한 확인 테스트
```bash
# 권한 없는 디바이스로 QR 스캔
curl -X POST \
  "https://18gffqu5rb.execute-api.ap-northeast-2.amazonaws.com/qr/scan" \
  -H "Content-Type: application/json" \
  -d '{
    "qrPayload": "{\"qr_id\":\"test-qr-id\",\"exp\":9999999999,\"sig\":\"test-sig\"}",
    "deviceId": "device-without-permission"
  }'

# 예상 응답 (권한 없음):
# {
#   "success": false,
#   "requiresPermission": true,
#   "message": "Required permissions not granted",
#   "platform": "IOS"
# }
```

---

### Phase 5: 모니터링 설정 (15분)

#### 5.1 CloudWatch 로그 확인
```bash
# 최근 로그 확인
aws logs tail /aws/lambda/LockMomentAPI --follow

# 에러 로그 필터링
aws logs filter-log-events \
  --log-group-name /aws/lambda/LockMomentAPI \
  --filter-pattern "ERROR"
```

#### 5.2 CloudWatch 알람 설정
```bash
# Lambda 에러율 알람
aws cloudwatch put-metric-alarm \
  --alarm-name LockMomentAPI-ErrorRate \
  --alarm-description "Alert when error rate exceeds 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 0.05 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# Lambda 실행 시간 알람
aws cloudwatch put-metric-alarm \
  --alarm-name LockMomentAPI-Duration \
  --alarm-description "Alert when duration exceeds 3 seconds" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 3000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

---

## ✅ 배포 체크리스트

### 배포 전
- [ ] RDS 스냅샷 생성
- [ ] Lambda 함수 백업
- [ ] 환경 변수 확인
- [ ] 테스트 계획 수립

### 데이터베이스
- [ ] migration_20260208.sql 실행
- [ ] devices 테이블 권한 컬럼 확인
- [ ] child_schedules 테이블 생성 확인
- [ ] 인덱스 생성 확인
- [ ] 트리거 동작 확인

### Lambda
- [ ] index_updated.mjs로 함수 업데이트
- [ ] 환경 변수 설정 확인
- [ ] 테스트 이벤트 실행
- [ ] CloudWatch 로그 확인

### API Gateway
- [ ] 새 라우트 3개 추가
- [ ] Lambda 통합 설정
- [ ] CORS 설정 확인
- [ ] API 배포

### 테스트
- [ ] 권한 업데이트 API 테스트
- [ ] 자녀 목록 조회 API 테스트
- [ ] 스케줄 CRUD API 테스트
- [ ] QR 스캔 권한 확인 테스트
- [ ] 에러 케이스 테스트

### 모니터링
- [ ] CloudWatch 로그 스트림 확인
- [ ] 알람 설정
- [ ] 대시보드 생성 (선택사항)

---

## 🐛 트러블슈팅

### 문제 1: 마이그레이션 실패
**증상**: SQL 실행 중 에러 발생

**해결**:
```sql
-- 기존 제약 조건 확인
SELECT conname FROM pg_constraint WHERE conrelid = 'devices'::regclass;

-- 충돌하는 제약 조건 삭제
ALTER TABLE devices DROP CONSTRAINT IF EXISTS conflicting_constraint;

-- 마이그레이션 재실행
```

### 문제 2: Lambda 함수 타임아웃
**증상**: Lambda 함수가 30초 이상 실행

**해결**:
```bash
# Lambda 타임아웃 증가 (최대 900초)
aws lambda update-function-configuration \
  --function-name LockMomentAPI \
  --timeout 60

# DB 연결 풀 설정 확인
# index.mjs에서 pool 설정 조정
```

### 문제 3: API Gateway 404 에러
**증상**: 새 엔드포인트 호출 시 404 반환

**해결**:
```bash
# API 배포 확인
aws apigatewayv2 get-deployments --api-id $API_ID

# 강제 재배포
aws apigatewayv2 create-deployment \
  --api-id $API_ID \
  --stage-name $default
```

### 문제 4: CORS 에러
**증상**: 브라우저에서 CORS 에러 발생

**해결**:
```bash
# CORS 설정 업데이트
aws apigatewayv2 update-cors \
  --api-id $API_ID \
  --cors-configuration \
    AllowOrigins='*',\
    AllowMethods='GET,POST,PATCH,PUT,DELETE,OPTIONS',\
    AllowHeaders='Content-Type,Authorization',\
    MaxAge=3600
```

---

## 📊 성능 벤치마크

### 예상 성능 지표

| API | 평균 응답 시간 | 목표 |
|-----|--------------|------|
| GET /parent-child/children | 150ms | < 300ms |
| POST /parent-child/{childId}/schedules | 200ms | < 500ms |
| PATCH /devices/{deviceId}/permissions | 100ms | < 200ms |
| POST /qr/scan | 180ms | < 300ms |

### 부하 테스트 (선택사항)
```bash
# Apache Bench 사용
ab -n 1000 -c 10 \
  -H "Authorization: Bearer TOKEN" \
  https://your-api-gateway-url/parent-child/children

# 또는 Artillery 사용
artillery quick --count 100 --num 10 \
  https://your-api-gateway-url/parent-child/children
```

---

## 🔄 롤백 계획

### 데이터베이스 롤백
```bash
# RDS 스냅샷으로 복원
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier lockmoment-db-restored \
  --db-snapshot-identifier lockmoment-backup-20260208
```

### Lambda 롤백
```bash
# 이전 버전으로 롤백
cd backup/lambda
zip -r function-rollback.zip index_backup_20260208.mjs

aws lambda update-function-code \
  --function-name LockMomentAPI \
  --zip-file fileb://function-rollback.zip
```

### API Gateway 롤백
```bash
# 이전 배포로 롤백
aws apigatewayv2 update-stage \
  --api-id $API_ID \
  --stage-name $default \
  --deployment-id PREVIOUS_DEPLOYMENT_ID
```

---

## 📝 배포 후 작업

### 1. 문서 업데이트
- [ ] API 문서를 팀과 공유
- [ ] 프론트엔드 팀에 변경사항 전달
- [ ] README 업데이트

### 2. 모니터링
- [ ] 첫 24시간 CloudWatch 로그 모니터링
- [ ] 에러율 확인
- [ ] 응답 시간 확인

### 3. 사용자 피드백
- [ ] 베타 테스터에게 새 기능 안내
- [ ] 피드백 수집
- [ ] 버그 리포트 추적

---

## 🎯 다음 단계

### 단기 (1-2주)
1. 스케줄 수정/삭제 API 구현
2. JWT 인증 강화
3. Rate Limiting 설정

### 중기 (1개월)
1. 잠금 이력 조회 API
2. 통계 대시보드 API
3. 푸시 알림 통합

### 장기 (3개월)
1. 실시간 동기화 (WebSocket)
2. 고급 분석 기능
3. 멀티 테넌시 지원

---

## 📞 지원 및 문의

**문제 발생 시**:
1. CloudWatch 로그 확인
2. RDS 연결 상태 확인
3. API Gateway 메트릭 확인

**긴급 연락**:
- 백엔드 담당: [연락처]
- DevOps: [연락처]

---

**배포 완료 일시**: _______________
**배포 담당자**: _______________
**검증 담당자**: _______________

---

이 체크리스트를 따라 단계별로 배포를 진행하시면 안전하게 새로운 기능을 프로덕션에 적용할 수 있습니다!
