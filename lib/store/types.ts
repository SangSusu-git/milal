/**
 * 키-값 JSON 저장소. 값은 JSON으로 직렬화 가능한 것이어야 한다.
 * 구현: memory(테스트), file(로컬), blob(배포)
 */
export interface Store {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}
