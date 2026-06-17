import { useState, useCallback } from 'react'
import {
  LiveKitRoom,
  useLocalParticipant,
  useParticipants,
  useTracks,
  VideoTrack,
  AudioTrack
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import '@livekit/components-styles'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Monitor, MonitorOff, PhoneOff, Users, MessageSquare } from 'lucide-react'
import api from '../../services/api'
import { useState as useStateAlias, useEffect } from 'react'

function RoomControls({ onLeave, onToggleChat, showChat }) {
  const { localParticipant } = useLocalParticipant()
  const participants = useParticipants()
  const [micOn, setMicOn] = useState(false)
  const [screenOn, setScreenOn] = useState(false)

  const toggleMic = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(!micOn)
    setMicOn(m => !m)
  }, [localParticipant, micOn])

  const toggleScreen = useCallback(async () => {
    await localParticipant.setScreenShareEnabled(!screenOn)
    setScreenOn(s => !s)
  }, [localParticipant, screenOn])

  const screenTracks = useTracks(
    [{ source: Track.Source.ScreenShare }],
    { onlySubscribed: true }
  )

  const audioTracks = useTracks(
    [{ source: Track.Source.Microphone }],
    { onlySubscribed: true }
  )

  return (
    <div className="flex flex-col h-full">
      {/* Hidden audio */}
      {audioTracks.map(t => (
        <AudioTrack key={t.participant.identity} trackRef={t} />
      ))}

      {/* Screen share area — takes all available space */}
      <div className="flex-1 bg-black rounded-xl overflow-hidden relative min-h-0">
        {screenTracks.length > 0 ? (
          screenTracks.map(t => (
            <div key={t.participant.identity} className="h-full">
              <p className="absolute top-2 left-2 text-xs text-white/70 bg-black/40 px-2 py-0.5 rounded-full z-10">
                {t.participant.identity} is sharing
              </p>
              <VideoTrack trackRef={t} className="w-full h-full object-contain" />
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-white/40 gap-3">
            <Monitor className="w-12 h-12" />
            <p className="text-sm">No screen being shared</p>
            <p className="text-xs">Click Share below to share your screen</p>
          </div>
        )}
      </div>

      {/* Bottom controls bar */}
      <div className="flex items-center justify-between pt-3 flex-shrink-0">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{participants.length} in call</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={micOn ? 'default' : 'outline'} onClick={toggleMic}>
            {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </Button>
          <Button size="sm" variant={screenOn ? 'default' : 'outline'} onClick={toggleScreen}>
            {screenOn ? <MonitorOff className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
          </Button>
          <Button size="sm" variant={showChat ? 'default' : 'outline'} onClick={onToggleChat}>
            <MessageSquare className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="destructive" onClick={onLeave}>
            <PhoneOff className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function VoiceRoom({ sessionId, roomId, onLeave, onToggleChat, showChat }) {
  const [token, setToken] = useState(null)
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get(`/sessions/${sessionId}/livekit-token?roomId=${roomId || sessionId}`)
      .then(res => {
        setToken(res.data.token)
        setUrl(res.data.url)
      })
      .catch(() => setError('Failed to connect to voice room'))
  }, [sessionId])

  if (error) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-destructive">{error}</p>
    </div>
  )
  if (!token) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Connecting to call...</p>
    </div>
  )

  return (
    <LiveKitRoom token={token} serverUrl={url} connect={true} audio={false} video={false} className="h-full">
      <RoomControls onLeave={onLeave} onToggleChat={onToggleChat} showChat={showChat} />
    </LiveKitRoom>
  )
}