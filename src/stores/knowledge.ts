// src/stores/knowledge.ts
import { defineStore } from 'pinia'
import { reactive } from 'vue'

// 定义和 formData 一致的类型
interface FormData {
  id: string
  name: string
  content: string
  description: string
  knowledge_base_id: string
}

export const useKnowledgeStore = defineStore('knowledge', {
  state: () => ({
    currentArticle: reactive<FormData>({
      id: '',
      name: '',
      content: '',
      description: '',
      knowledge_base_id: '',
    })
  }),
  actions: {
    // 更新当前文章数据
    setCurrentArticle(data: FormData) {
      this.currentArticle = reactive({ ...data }) // 深拷贝避免引用问题
    },
    // 清空文章数据（可选）
    clearCurrentArticle() {
      this.currentArticle = reactive({
        id: '',
        name: '',
        content: '',
        description: '',
        knowledge_base_id: '',
      })
    }
  }
})
