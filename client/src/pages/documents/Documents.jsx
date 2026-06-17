import { useState, useEffect } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Upload, BookOpen, Brain, Loader2, Clock } from 'lucide-react'

export default function Documents() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('summary')
  const [savedDocs, setSavedDocs] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(true)

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetchSavedDocs()
  }, [])

  const fetchSavedDocs = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/sessions/ai/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setSavedDocs(data)
    } catch (err) {
      console.error('Failed to load saved docs')
    } finally {
      setLoadingDocs(false)
    }
  }

  const handleFileChange = (e) => {
    setFile(e.target.files[0])
    setResult(null)
    setError('')
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('http://localhost:5000/api/sessions/ai/document', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Something went wrong')
      } else {
        setResult(data)
        setSavedDocs(prev => [data, ...prev])
      }
    } catch (err) {
      setError('Could not connect to server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">My Documents</h1>
          <p className="text-muted-foreground mt-1">
            Upload your study materials and get AI-generated summaries and flashcards
          </p>
        </div>

        {/* Upload Area */}
        <Card className="mb-6">
          <CardContent className="p-8">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Upload Study Material</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Upload a PDF of your lecture notes, textbook chapters, or study guides
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <label className="cursor-pointer">
                  <input type="file" accept=".pdf,.docx" onChange={handleFileChange} className="hidden" />
                  <div className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-secondary transition-colors">
                    {file ? file.name : 'Choose PDF or DOCX file'}
                  </div>
                </label>
                <Button onClick={handleUpload} disabled={!file || loading}>
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                  ) : (
                    <><Brain className="w-4 h-4 mr-2" />Generate with AI</>
                  )}
                </Button>
              </div>
              {file && (
                <p className="text-sm text-muted-foreground mt-3">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
            {error && (
              <div className="mt-4 bg-destructive/10 text-destructive text-sm p-4 rounded-lg">{error}</div>
            )}
          </CardContent>
        </Card>

        {/* Current Result */}
        {result && (
          <ResultCard result={result} activeTab={activeTab} setActiveTab={setActiveTab} />
        )}

        {/* Saved Documents */}
        {!loadingDocs && savedDocs.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Previously Generated</h2>
            <div className="space-y-4">
              {savedDocs.map((doc) => (
                <SavedDocCard key={doc._id} doc={doc} />
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}

function ResultCard({ result, activeTab, setActiveTab }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>AI Study Materials</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant={activeTab === 'summary' ? 'default' : 'outline'} onClick={() => setActiveTab('summary')}>
              <FileText className="w-4 h-4 mr-1" />Summary
            </Button>
            <Button size="sm" variant={activeTab === 'flashcards' ? 'default' : 'outline'} onClick={() => setActiveTab('flashcards')}>
              <BookOpen className="w-4 h-4 mr-1" />Flashcards ({result.flashcards?.length || 0})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activeTab === 'summary' && (
          <div className="bg-secondary/50 rounded-xl p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />Document Summary
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.summary}</p>
          </div>
        )}
        {activeTab === 'flashcards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.flashcards?.map((card, i) => <FlashCard key={i} card={card} index={i} />)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SavedDocCard({ doc }) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{doc.fileName}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(doc.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Hide' : 'View'}
          </Button>
        </div>

        {expanded && (
          <div className="mt-4">
            <div className="flex gap-2 mb-4">
              <Button size="sm" variant={activeTab === 'summary' ? 'default' : 'outline'} onClick={() => setActiveTab('summary')}>
                <FileText className="w-3.5 h-3.5 mr-1" />Summary
              </Button>
              <Button size="sm" variant={activeTab === 'flashcards' ? 'default' : 'outline'} onClick={() => setActiveTab('flashcards')}>
                <BookOpen className="w-3.5 h-3.5 mr-1" />Flashcards ({doc.flashcards?.length || 0})
              </Button>
            </div>
            {activeTab === 'summary' && (
              <div className="bg-secondary/50 rounded-xl p-5">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{doc.summary}</p>
              </div>
            )}
            {activeTab === 'flashcards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doc.flashcards?.map((card, i) => <FlashCard key={i} card={card} index={i} />)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FlashCard({ card, index }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div className="cursor-pointer border border-border rounded-xl p-5 hover:shadow-md transition-all" onClick={() => setFlipped(!flipped)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-full">Card {index + 1}</span>
        <span className="text-xs text-muted-foreground">{flipped ? 'Answer' : 'Question'} · Click to flip</span>
      </div>
      <p className="text-sm font-medium leading-relaxed">{flipped ? card.answer : card.question}</p>
    </div>
  )
}