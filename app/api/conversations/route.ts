import { getDb, isMongoAvailable } from '@/lib/mongodb'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ skipped: true }, { status: 200 })
    }

    const body = await req.json()
    const { conversationId, userId, role, content, fragment, model, createdAt } = body

    if (!conversationId || !role) {
      return NextResponse.json(
        { error: 'conversationId and role are required' },
        { status: 400 },
      )
    }

    const db = await getDb()
    const result = await db.collection('messages').insertOne({
      conversationId,
      userId: userId || 'anonymous',
      role,
      content: content || null,
      fragment: fragment || null,
      model: model || null,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
    })

    return NextResponse.json({ id: result.insertedId }, { status: 201 })
  } catch (error) {
    console.error('Failed to save conversation:', error)
    return NextResponse.json(
      { error: 'Failed to save conversation' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ messages: [], skipped: true })
    }

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (!conversationId && !userId) {
      return NextResponse.json(
        { error: 'Conversation ID or userId is required' },
        { status: 400 },
      )
    }

    const filter: Record<string, string> = {}
    if (conversationId) filter.conversationId = conversationId
    if (userId) filter.userId = userId

    const db = await getDb()
    const messages = await db
      .collection('messages')
      .find(filter)
      .sort({ createdAt: 1 })
      .toArray()

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Failed to fetch conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 },
    )
  }
}
