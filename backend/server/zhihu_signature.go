package main

import (
	"crypto/md5"
	"encoding/binary"
	"encoding/hex"
	"math/bits"
	"strings"
)

// ZSE v4 wire constants used by the Zhihu web client. Protocol reference:
// https://github.com/zly2006/zhihu-plus-plus/blob/master/shared/src/commonMain/kotlin/com/github/zly2006/zhihu/util/ZhihuFetchSignature.kt
// Multipart bodies are excluded; JSON requests append the exact serialized body.
const zhihuZse93 = "101_3_3.0"

func readingSignature(dc0 string) string {
	return zhihuSignature("/lastread/touch", dc0)
}

func zhihuSignature(path, dc0 string, body ...string) string {
	parts := append([]string{zhihuZse93, path, dc0}, body...)
	digest := md5.Sum([]byte(strings.Join(parts, "+")))
	plain := append([]byte{12, 0}, []byte(hex.EncodeToString(digest[:]))...)
	pad := 16 - len(plain)%16
	for i := 0; i < pad; i++ {
		plain = append(plain, byte(pad))
	}
	key := []byte("059053f7d15e01d7")
	var previous [16]byte
	encrypted := make([]byte, 0, len(plain)+2)
	for offset := 0; offset < len(plain); offset += 16 {
		var words [36]uint32
		var block [16]byte
		for i := range block {
			mask := previous[i]
			if offset == 0 {
				mask = key[i] ^ 42
			}
			block[i] = plain[offset+i] ^ mask
		}
		for i := 0; i < 4; i++ {
			words[i] = binary.BigEndian.Uint32(block[i*4:])
		}
		for i, roundKey := range zseZK {
			x := words[i+1] ^ words[i+2] ^ words[i+3] ^ roundKey
			x = uint32(zseZB[x>>24])<<24 | uint32(zseZB[(x>>16)&255])<<16 | uint32(zseZB[(x>>8)&255])<<8 | uint32(zseZB[x&255])
			words[i+4] = words[i] ^ x ^ bits.RotateLeft32(x, 2) ^ bits.RotateLeft32(x, 10) ^ bits.RotateLeft32(x, 18) ^ bits.RotateLeft32(x, 24)
		}
		for i := 0; i < 4; i++ {
			binary.BigEndian.PutUint32(previous[i*4:], words[35-i])
		}
		encrypted = append(encrypted, previous[:]...)
	}
	for len(encrypted)%3 != 0 {
		encrypted = append(encrypted, 0)
	}
	const alphabet = "6fpLRqJO8M/c3jnYxFkUVC4ZIG12SiH=5v0mXDazWBTsuw7QetbKdoPyAl+hN9rgE"
	result := []byte("2.0_")
	index := 0
	for p := len(encrypted) - 1; p >= 0; p -= 3 {
		var value uint32
		for j := 0; j < 3; j++ {
			mask := byte(uint32(58) >> (8 * (index % 4)))
			value |= uint32(encrypted[p-j]^mask) << (8 * j)
			index++
		}
		for j := 0; j < 4; j++ {
			result = append(result, alphabet[(value>>(6*j))&63])
		}
	}
	return string(result)
}

var zseZK = [...]uint32{
	1170614578, 1024848638, 1413669199, 3951632832, 3528873006, 2921909214, 4151847688, 3997739139,
	1933479194, 3323781115, 3888513386, 460404854, 3747539722, 2403641034, 2615871395, 2119585428,
	2265697227, 2035090028, 2773447226, 4289380121, 4217216195, 2200601443, 3051914490, 1579901135,
	1321810770, 456816404, 2903323407, 4065664991, 330002838, 3506006750, 363569021, 2347096187,
}

var zseZB = [...]byte{
	20, 223, 245, 7, 248, 2, 194, 209,
	87, 6, 227, 253, 240, 128, 222, 91,
	237, 9, 125, 157, 230, 93, 252, 205,
	90, 79, 144, 199, 159, 197, 186, 167,
	39, 37, 156, 198, 38, 42, 43, 168,
	217, 153, 15, 103, 80, 189, 71, 191,
	97, 84, 247, 95, 36, 69, 14, 35,
	12, 171, 28, 114, 178, 148, 86, 182,
	32, 83, 158, 109, 22, 255, 94, 238,
	151, 85, 77, 124, 254, 18, 4, 26,
	123, 176, 232, 193, 131, 172, 143, 142,
	150, 30, 10, 146, 162, 62, 224, 218,
	196, 229, 1, 192, 213, 27, 110, 56,
	231, 180, 138, 107, 242, 187, 54, 120,
	19, 44, 117, 228, 215, 203, 53, 239,
	251, 127, 81, 11, 133, 96, 204, 132,
	41, 115, 73, 55, 249, 147, 102, 48,
	122, 145, 106, 118, 74, 190, 29, 16,
	174, 5, 177, 129, 63, 113, 99, 31,
	161, 76, 246, 34, 211, 13, 60, 68,
	207, 160, 65, 111, 82, 165, 67, 169,
	225, 57, 112, 244, 155, 51, 236, 200,
	233, 58, 61, 47, 100, 137, 185, 64,
	17, 70, 234, 163, 219, 108, 170, 166,
	59, 149, 52, 105, 24, 212, 78, 173,
	45, 0, 116, 226, 119, 136, 206, 135,
	175, 195, 25, 92, 121, 208, 126, 139,
	3, 75, 141, 21, 130, 98, 241, 40,
	154, 66, 184, 49, 181, 46, 243, 88,
	101, 183, 8, 23, 72, 188, 104, 179,
	210, 134, 250, 201, 164, 89, 216, 202,
	220, 50, 221, 152, 140, 33, 235, 214,
}
